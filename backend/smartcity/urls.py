from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path

APP_URLS = ['accounts', 'collection', 'scenarios', 'pokestops', 'events', 'game', 'moderation']
prefix = settings.APP.app.api_prefix.strip('/')

urlpatterns = [path(f'{prefix}/', include(f'apps.{app}.urls')) for app in APP_URLS]
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
