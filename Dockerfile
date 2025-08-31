# StudioManager Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
	&& adduser --disabled-password --gecos '' appuser \
	&& chown -R appuser:appuser /app

COPY . .
USER appuser

EXPOSE 5000

CMD ["gunicorn", "-c", "gunicorn.conf.py", "run:app"]
