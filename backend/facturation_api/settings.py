from pathlib import Path
import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
)
environ.Env.read_env(BASE_DIR / '.env')

SECRET_KEY = env('SECRET_KEY', default='dev-insecure-change-me')
DEBUG = env('DEBUG')
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['*'])

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'apps.core',
    'apps.legacy',
    'apps.auth_legacy',
    'apps.fat',
    'apps.docs',
]

AUTHENTICATION_BACKENDS = [
    'apps.auth_legacy.backends.LegacyOracleAuthBackend',
    'django.contrib.auth.backends.ModelBackend',  # fallback para superuser local
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'facturation_api.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'facturation_api.wsgi.application'

# Solo SQLite para metadata de la app nueva (auth, permisos, auditoria).
# El Oracle legado se accede SIEMPRE via apps.legacy.client (oracledb directo).
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'data' / 'app.sqlite3',
    },
}

# Config para apps.legacy.client (no es DATABASES de Django).
LEGACY_ORACLE = {
    'DSN': env('ORACLE_DSN', default='10.0.0.51:1521/AB'),
    'USER': env('ORACLE_USER', default='JCABREU'),
    'PASSWORD': env('ORACLE_PASSWORD', default=''),
    'INSTANT_CLIENT_DIR': env('ORACLE_INSTANT_CLIENT', default='/opt/oracle/instantclient'),
    'POOL_MIN': env.int('ORACLE_POOL_MIN', default=1),
    'POOL_MAX': env.int('ORACLE_POOL_MAX', default=8),
}

LANGUAGE_CODE = 'es-do'
TIME_ZONE = 'America/Santo_Domingo'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.auth_legacy.authentication.CsrfExemptSessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

CORS_ALLOWED_ORIGINS = env.list(
    'CORS_ALLOWED_ORIGINS',
    default=['http://localhost:5173', 'http://127.0.0.1:5173'],
)
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

# El frontend manda peticiones autenticadas con cookies; en dev relajamos CSRF
# para sesiones cross-origin. Esto solo aplica con DEBUG=1.
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = False
