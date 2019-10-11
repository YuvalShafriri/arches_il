# -*- coding: utf-8 -*-
# Generated by Django 1.11.15 on 2019-02-07 15:17
from __future__ import unicode_literals

from django.db import migrations
from arches.app.models.system_settings import settings
from arches.app.search.search_engine_factory import SearchEngineFactory
from arches.app.search.mappings import prepare_terms_index, \
    prepare_concepts_index, prepare_search_index, prepare_resource_relations_index


class Migration(migrations.Migration):

    dependencies = [
        ('models', '4658_adds_nodevalue_type_widget_config'),
    ]

    def forwards_func(apps, schema_editor):
        se = SearchEngineFactory().create()
        se_old = SearchEngineFactory().create(hosts=[settings.ELASTICSEARCH_TEMP_HTTP_ENDPOINT])
        prefix = settings.ELASTICSEARCH_PREFIX
        if (se.es.indices.exists(index="%s_terms" % prefix) is False and 
                se_old.es.indices.exists(index="%s_strings" % prefix) is True):
            prepare_terms_index(create=True)
            doc = {
                "source": {
                    "remote": {
                        "host": settings.ELASTICSEARCH_TEMP_HTTP_ENDPOINT
                    },
                    "index": "%s_strings" % prefix,
                    "type": "term"
                },
                "dest": {
                    "index": "%s_terms" % prefix,
                    "type": "_doc"
                }
            }
            se.es.reindex(body=doc)

        if (se.es.indices.exists(index="%s_concepts" % prefix) is False and 
                se_old.es.indices.exists(index="%s_strings" % prefix) is True):
            prepare_concepts_index(create=True)
            doc = {
                "source": {
                    "remote": {
                        "host": settings.ELASTICSEARCH_TEMP_HTTP_ENDPOINT
                    },
                    "index": "%s_strings" % prefix,
                    "type": "concept"
                },
                "dest": {
                    "index": "%s_concepts" % prefix,
                    "type": "_doc"
                }
            }
            se.es.reindex(body=doc)

        if(se.es.indices.exists(index="%s_resources" % prefix) is False and 
                se_old.es.indices.exists(index="%s_resource" % prefix) is True):
            prepare_search_index(create=True)
            doc = {
                "source": {
                    "remote": {
                        "host": settings.ELASTICSEARCH_TEMP_HTTP_ENDPOINT
                    },
                    "index": "%s_resource" % prefix
                },
                "dest": {
                    "index": "%s_resources" % prefix,
                    "type": "_doc"
                }
            }
            se.es.reindex(body=doc)

        if(se.es.indices.exists(index="%s_resource_relations" % prefix) is False and 
                se_old.es.indices.exists(index="%s_resource_relations" % prefix) is True):
            prepare_resource_relations_index(create=True)
            doc = {
                "source": {
                    "remote": {
                        "host": settings.ELASTICSEARCH_TEMP_HTTP_ENDPOINT
                    },
                    "index": "%s_resource_relations" % prefix
                },
                "dest": {
                    "index": "%s_resource_relations" % prefix,
                    "type": "_doc"
                }
            }
            se.es.reindex(body=doc)

    def reverse_func(apps, schema_editor):
        pass

    operations = [
        migrations.RunPython(forwards_func, reverse_func),
    ]
