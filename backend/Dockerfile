# Obraz backendu. Wersja Pythona jest parametrem: docker build --build-arg PYTHON_VERSION=3.13 .
ARG PYTHON_VERSION=3.13
FROM python:${PYTHON_VERSION}-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements/ requirements/
RUN pip install --no-cache-dir -r requirements/prod.txt

COPY . .
# sed zdejmuje ewentualne CR (checkout na Windows z core.autocrlf=true), inaczej powłoka nie znajdzie interpretera skryptu
RUN sed -i 's/\r$//' docker/entrypoint.sh \
    && chmod +x docker/entrypoint.sh \
    && useradd --system --uid 10001 app \
    && mkdir -p data \
    && chown -R app /app
USER app

# Port, liczba procesów i limit czasu pochodzą z config/default.yaml (sekcja `server`), nie z tego pliku.
ENTRYPOINT ["docker/entrypoint.sh"]
CMD ["gunicorn", "smartcity.wsgi:application", "--config", "config/gunicorn.py"]
