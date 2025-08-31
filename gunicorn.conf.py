import multiprocessing
import os

# Workers/threads
workers = int(os.getenv("GUNICORN_WORKERS", max(2, multiprocessing.cpu_count() // 2)))
threads = int(os.getenv("GUNICORN_THREADS", 2))

# Networking
bind = os.getenv("GUNICORN_BIND", "0.0.0.0:5000")
backlog = int(os.getenv("GUNICORN_BACKLOG", 2048))

# Timeouts
timeout = int(os.getenv("GUNICORN_TIMEOUT", 90))
keepalive = int(os.getenv("GUNICORN_KEEPALIVE", 5))

# Process naming
proc_name = os.getenv("GUNICORN_PROC_NAME", "studio-manager")

# Logging
accesslog = os.getenv("GUNICORN_ACCESSLOG", "-")  # stdout
errorlog = os.getenv("GUNICORN_ERRORLOG", "-")    # stderr
loglevel = os.getenv("GUNICORN_LOGLEVEL", "info")

# Security
limit_request_line = 8190
limit_request_fields = 100
limit_request_field_size = 8190

# Performance
worker_tmp_dir = "/dev/shm"

# Preload to reduce memory on copy-on-write OS
preload_app = os.getenv("GUNICORN_PRELOAD", "true").lower() == "true"
