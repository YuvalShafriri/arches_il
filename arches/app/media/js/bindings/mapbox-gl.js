define([
    'jquery',
    'underscore',
    'knockout',
    'mapbox-gl',
    'arches',
    'bindings/nouislider',
    'bindings/sortable'
], function($, _, ko, mapboxgl, arches) {
    ko.bindingHandlers.mapboxgl = {
        init: function(element, valueAccessor) {
            var defaults = {
                container: element
            };
            var options = ko.unwrap(valueAccessor()).mapOptions || {};
            var mapInitOptions = {};
            mapboxgl.accessToken = arches.mapboxApiKey;
            mapboxgl.setRTLTextPlugin(
                //add rtl plugin
                'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js',
                null,
                true // Lazy load the plugin
                );

            _.each(options, function(option, key){
                if (ko.isObservable(option)){
                    mapInitOptions[key] = option();
                } else {
                    mapInitOptions[key] = option;
                }
            });

            if (mapInitOptions.centerX && mapInitOptions.centerY) {
                mapInitOptions['center'] = [
                    mapInitOptions.centerX,
                    mapInitOptions.centerY
                ];
            }

            var map = new mapboxgl.Map(
                _.defaults(mapInitOptions, defaults)
            );
            map.on('load', function() {
                _.each(arches.mapMarkers, function(marker) {
                    map.loadImage(marker.url, function(error, image) {
                        if (error) throw error;
                        map.addImage(marker.name, image);
                    });
                });
            });
          /*remove setterrain*/  
            // prevents drag events from bubbling
            $(element).mousedown(function(event) {
                event.stopPropagation();
            });

            if (typeof ko.unwrap(valueAccessor()).afterRender === 'function') {
                ko.unwrap(valueAccessor()).afterRender(map);
            }

            if (ko.isObservable(options.zoom)) {
                options.zoom.subscribe(function(val) {
                    map.setZoom(val);
                }, this);
            }

            if (ko.isObservable(options.centerX)) {
                options.centerX.subscribe(function(val) {
                    map.setCenter(new mapboxgl.LngLat(val, options.centerY()));
                }, this);
            }

            if (ko.isObservable(options.centerY)) {
                options.centerY.subscribe(function(val) {
                    map.setCenter(new mapboxgl.LngLat(options.centerX(), val));
                }, this);
            }

            if (ko.isObservable(options.pitch)) {
                options.pitch.subscribe(function(val) {
                    map.setPitch(val);
                }, this);
            }

            if (ko.isObservable(options.setBearing)) {
                options.bearing.subscribe(function(val) {
                    map.setBearing(val);
                }, this);
            }

            ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
                map.remove();
            });
        }
    };

    return ko.bindingHandlers.mapboxgl;
});
