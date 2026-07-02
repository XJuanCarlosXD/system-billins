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
    'apps.cnt',
    'apps.docs',
    'apps.mcp',
    'apps.asistente',
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
    'facturation_api.middleware.ApiCsrfExemptMiddleware',
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
MEDIA_ROOT = BASE_DIR / 'media'
MEDIA_URL = '/media/'
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
CORS_ALLOWED_ORIGIN_REGEXES = env.list(
    'CORS_ALLOWED_ORIGIN_REGEXES',
    default=[r'^https://.*\.netlify\.app$'],
)
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS + [
    'https://*.netlify.app',
    'https://grupo-abregonza.hopto.org:8443',
]

# Backend detras de Caddy/proxy HTTPS publico (PUBLIC_HTTPS=1):
#   - confiar en X-Forwarded-Proto
#   - cookies cross-site requieren SameSite=None + Secure=True
# En dev local (sin proxy) PUBLIC_HTTPS no se setea y caen a defaults laxos.
PUBLIC_HTTPS = env.bool('PUBLIC_HTTPS', default=False)
if PUBLIC_HTTPS:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    USE_X_FORWARDED_HOST = True
    SESSION_COOKIE_SAMESITE = 'None'
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SAMESITE = 'None'
    CSRF_COOKIE_SECURE = True
else:
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = False
    CSRF_COOKIE_SAMESITE = 'Lax'
    CSRF_COOKIE_SECURE = False

# === ZentoryERP MCP ===
MEMORY_ROUTER_URL = env('MEMORY_ROUTER_URL', default='')
MEMORY_ROUTER_TOKEN = env('MEMORY_ROUTER_TOKEN', default='')
MEMORY_ROUTER_PROJECT = env('MEMORY_ROUTER_PROJECT', default='facture-project')
MCP_TOKEN_CACHE_TTL = env.int('MCP_TOKEN_CACHE_TTL', default=60)
MCP_RATELIMIT_PER_MIN = env.int('MCP_RATELIMIT_PER_MIN', default=60)
MCP_DOWNLOAD_TTL_SECONDS = env.int('MCP_DOWNLOAD_TTL_SECONDS', default=900)

# === Asistente en pagina (apps.asistente) ===
ANTHROPIC_API_KEY = env('ANTHROPIC_API_KEY', default='')
ASISTENTE_DEFAULT_MODEL = env('ASISTENTE_DEFAULT_MODEL', default='claude-haiku-4-5')
ASISTENTE_MAX_TURNS = env.int('ASISTENTE_MAX_TURNS_PER_CONVERSATION', default=200)
ASISTENTE_DAILY_BUDGET_USD = env.float('ASISTENTE_DAILY_BUDGET_USD_PER_USER', default=2.0)
ASISTENTE_TOOL_PENDING_TTL_SEC = env.int('ASISTENTE_TOOL_PENDING_TTL_SEC', default=300)
