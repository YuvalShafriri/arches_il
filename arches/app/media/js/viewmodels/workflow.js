define([
    'arches',
    'jquery',
    'underscore',
    'knockout',
    'knockout-mapping',
    'uuid',
    'viewmodels/alert',
    'viewmodels/workflow-step',
    'bindings/scrollTo'
], function(arches, $, _, ko, koMapping, uuid, AlertViewModel, Step) {
    WORKFLOW_LABEL = 'workflow';
    WORKFLOW_ID_LABEL = 'workflow-id';
    STEPS_LABEL = 'workflow-steps';
    STEP_ID_LABEL = 'workflow-step-id';
    STEP_IDS_LABEL = 'workflow-step-ids';

    var Workflow = function(config) {
        var self = this;

        this.id = ko.observable();

        this.steps = config.steps || [];
        
        this.hoverStep = ko.observable();
        this.previousStep = ko.observable();

        this.activeStep = ko.observable();
        this.activeStep.subscribe(function() {
            self.checkCanFinish();
        });

        this.furthestValidStepIndex = ko.observable();

        this.ready = ko.observable(false);
        this.ready.subscribe(function() {
            var components = _.unique(self.steps.map(function(step) {return step.component;}));
            require(components, function() { self.initialize(); });
        });

        this.loading = config.loading || ko.observable(false);

        this.workflowName = ko.observable();
        this.canFinish = ko.observable(false);
        this.alert = config.alert || ko.observable(null);
        this.quitUrl = arches.urls.home;

        this.wastebinWarning = function(val){
            return [[arches.translations.workflowWastbinWarning.replace("${val}", val)],[arches.translations.workflowWastbinWarning2]];
        };
        this.warning = '';

        this.initialize = function() {
            /* workflow ID url logic */  
            var currentWorkflowId = self.getWorkflowIdFromUrl();
            if (currentWorkflowId) {
                self.id(currentWorkflowId)
            }
            else {
                self.id(uuid.generate());
                self.setWorkflowIdToUrl();
            }

            /* cached Step data logic */ 
            if (self.getFromLocalStorage(WORKFLOW_ID_LABEL) === self.id()) {
                var cachedStepIds = self.getFromLocalStorage(STEP_IDS_LABEL);
                self.createSteps(cachedStepIds);
            }
            else {
                self.setToLocalStorage(WORKFLOW_ID_LABEL, self.id());
                localStorage.removeItem(STEPS_LABEL);

                self.createSteps();

                var stepIds = self.steps.map(function(step) { return step.id(); })
                self.setToLocalStorage(STEP_IDS_LABEL, stepIds);
            }

            self.getFurthestValidStepIndex();

            /* cached activeStep logic */ 
            var cachedActiveStep = self.steps.find(function(step) {
                return step.id() === self.getStepIdFromUrl();
            });

            if (cachedActiveStep) {
                self.activeStep(cachedActiveStep);
            }
            else {
                self.removeStepIdFromUrl();

                if(self.steps.length > 0) {
                    self.activeStep(self.steps[0]);
                }
            }
        };

        this.createSteps = function(cachedStepIds) {
            self.steps.forEach(function(step, i) {
                if (!(self.steps[i] instanceof Step)) {
                    step.workflow = self;
                    step.loading = self.loading;
                    step.alert = self.alert;

                    /* if stepIds exist for this workflow in localStorage, set correct value */ 
                    if (cachedStepIds) { step.id = cachedStepIds[i]; }

                    var newStep = new Step(step);
                    self.steps[i] = newStep;

                    self.steps[i].complete.subscribe(function(complete) {
                        self.getFurthestValidStepIndex();
                        if (complete && self.steps[i].autoAdvance()) self.next();
                    });
                }

                self.steps[i]._index = i;
            });
        };

        this.getStepData = function(stepName) {
            /* ONLY to be used as intermediary for when a step needs data from a different step in the workflow */
            var step = self.steps.find(function(step) { return ko.unwrap(step.name) === ko.unwrap(stepName) });
            if (step) { return step.value(); }
        };

        this.getStepIdFromUrl = function() {
            var searchParams = new URLSearchParams(window.location.search);
            return searchParams.get(STEP_ID_LABEL);
        };

        this.removeStepIdFromUrl = function() {
            var searchParams = new URLSearchParams(window.location.search);
            searchParams.delete(STEP_ID_LABEL);

            var newRelativePathQuery = `${window.location.pathname}?${searchParams.toString()}`;
            history.replaceState(null, '', newRelativePathQuery);
        };

        this.getFurthestValidStepIndex = function() {  /* useful for tab state logic */
            var furthestValidStepIndex = self.furthestValidStepIndex() || 0;
            var startIdx = 0;

            /* furthest completed step index */ 
            self.steps.forEach(function(step) {
                if (ko.unwrap(step.complete)) {
                    startIdx = step._index;
                }
            });

            /* furthest non-required step directly after furthest completed step */ 
            for (var i = startIdx; i < self.steps.length; i++) {
                var step = self.steps[i];

                if (ko.unwrap(step.complete) || !ko.unwrap(step.required)) {
                    furthestValidStepIndex = step._index;
                }
                else { break; }
            }

            if (!ko.unwrap(self.steps[furthestValidStepIndex].required)) {
                /* add onto index if furthest valid step isn't required */ 
                if (furthestValidStepIndex < self.steps.length) {
                    furthestValidStepIndex += 1;
                }
            }

            if (furthestValidStepIndex !== self.furthestValidStepIndex()) {
                self.furthestValidStepIndex(furthestValidStepIndex);
            }
        };

        this.getWorkflowIdFromUrl = function() {
            var searchParams = new URLSearchParams(window.location.search);
            return searchParams.get(WORKFLOW_ID_LABEL);
        };
        
        this.setWorkflowIdToUrl = function() {
            var searchParams = new URLSearchParams(window.location.search);
            searchParams.set(WORKFLOW_ID_LABEL, self.id());

            var newRelativePathQuery = `${window.location.pathname}?${searchParams.toString()}`;
            history.replaceState(null, '', newRelativePathQuery);
        };

        this.setToLocalStorage = function(key, value) {
            var workflowLocalStorageData = JSON.parse(localStorage.getItem(WORKFLOW_LABEL)) || {};
            
            workflowLocalStorageData[key] = value;

            localStorage.setItem(
                WORKFLOW_LABEL, 
                JSON.stringify(workflowLocalStorageData)
            );
        };

        this.getFromLocalStorage = function(key) {
            var localStorageData = JSON.parse(localStorage.getItem(WORKFLOW_LABEL));

            if (localStorageData) {
                return localStorageData[key];
            }
        };

        this.getJSON = function(pluginJsonFileName) {
            $.ajax({
                type: "GET",
                url: arches.urls.plugin(pluginJsonFileName),
                data: { "json":true },
                context: self,
                success: function(workflowJson){ self.workflowName(workflowJson.name); }
            });
        };

        this.checkCanFinish = function(){
            var required = false, canFinish = true, complete = null;
            for(var i = 0; i < self.steps.length; i++) {
                required = ko.unwrap(self.steps[i].required);
                complete = ko.unwrap(self.steps[i].complete);
                if(!complete && required) {
                    canFinish = false;
                    break;
                }
            }
            self.canFinish(canFinish);
        };

        this.finishWorkflow = function() {
            if(self.canFinish()){ self.activeStep(self.steps[self.steps.length-1]); }
        };

        this.quitWorkflow = function(){
            var resourcesToDelete = [];
            var tilesToDelete = [];
            var warnings = []

            self.steps.forEach(function(step) {
                if (step.wastebin && step.wastebin.resourceid) {
                    warnings.push(step.wastebin.description);
                    resourcesToDelete.push(step.wastebin);
                } else if (step.wastebin && step.wastebin.tile) {
                    warnings.push(step.wastebin.description);
                    tilesToDelete.push(step.wastebin);
                }
            });
            self.warning = self.wastebinWarning(warnings.join());
            var deleteObject = function(type, obj){
                if (type === 'resource') {
                    $.ajax({
                        url: arches.urls.api_resources(obj),
                        type: 'DELETE',
                        success: function(result) {
                            console.log('result', result);
                        }
                    });
                } else if (type === 'tile') {
                    $.ajax({
                        type: "DELETE",
                        url: arches.urls.tile,
                        data: JSON.stringify(obj)
                    }).done(function(response) {
                        console.log('deleted', obj.tileid);
                    }).fail(function(response) {
                        if (typeof onFail === 'function') {
                            console.log(response);
                        }
                    });
                }
            };

            self.alert(
                new AlertViewModel(
                    'ep-alert-red',
                    self.warning[0],
                    self.warning[1],
                    null,
                    function(){
                        resourcesToDelete.forEach(function(resource){deleteObject('resource', resource.resourceid);});
                        tilesToDelete.forEach(function(tile){deleteObject('tile', tile.tile);});
                        window.location.href = self.quitUrl;
                    }
                )
            );
        };

        this.canStepBecomeActive = function(step) {
            var canStepBecomeActive = false;

            
            if (step && !step.active() ) {  /* prevents refresh if clicking on active tab */ 
                
                if (step.complete() || self.canFinish() === true) { 
                    canStepBecomeActive = true; 
                }
                else {
                    var previousStep = self.steps[step._index - 1];

                    while (previousStep) {
                        if (self.canStepBecomeActive(previousStep) === true) {
                            canStepBecomeActive = true;
                            break;
                        }
                        else if (!previousStep.required() && (previousStep._index - 1 < step._index) ) {
                            previousStep = self.steps[previousStep._index - 1];
                        }
                        else {
                            break;
                        }
                    }
                }


            }

            return canStepBecomeActive;
        };

        this.next = function(){
            var activeStep = self.activeStep();

            if (
                (activeStep.complete() || !activeStep.required()) 
                && activeStep._index < self.steps.length - 1
            ) {
                self.activeStep(self.steps[activeStep._index+1]);
            }
        };

        this.back = function(){
            var activeStep = self.activeStep();

            if (activeStep && activeStep._index > 0) {
                self.activeStep(self.steps[activeStep._index - 1]);
            }
        };
    };

    return Workflow;
});
