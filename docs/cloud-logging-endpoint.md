# UI -> Cloud Function logging API (contract)

This documents the HTTP endpoint the UI will call to send structured logs to Google Cloud Logging.

You mentioned you will implement the function in Python later; below is the agreed request/response shape so the UI can call it today.

## Endpoint

- URL (prod example): `https://app-logs-7bpeqovfmq-de.a.run.app`
- Alternative (Functions alias): `https://asia-east1-jasperpos-1dfd5.cloudfunctions.net/app_logs`
- Method: `POST`
- Content-Type: `application/json`
- Optional header: `X-API-Key: <your-api-key>`

Configure the UI by setting `environment.cloudLoggingEndpoint` (already added in `environment*.ts`).

## Request body (LogEntry)

```json
{
  "timestamp": "2025-11-01T12:34:56.789Z",
  "level": "info",
  "severity": "INFO",
  "message": "Firestore operation succeeded",
  "area": "products",
  "api": "firestore.update",
  "collectionPath": "products",
  "docId": "prod_123",
  "correlationId": "a1b2c3d4",
  "userId": "uid_123",
  "companyId": "c_1",
  "storeId": "s_1",
  "status": 200,
  "success": true,
  "durationMs": 42,
  "payload": { "price": 12.5 },
  "labels": { "env": "prod" },
  "error": { "name": "FirebaseError", "message": "...", "code": "permission-denied", "stack": "..." }
}
```

Notes:
- `severity` should map to Cloud Logging severities: DEBUG | INFO | WARNING | ERROR.
- `payload` is sanitized on the client (sensitive keys redacted).
- `error` is optional and only included for failures.

## Response

- Success: `200 OK`
  ```json
  { "ok": true }
  ```
- Failure: `400 Bad Request` (or `500`), with message
  ```json
  { "ok": false, "error": "reason" }
  ```

## Python (Cloud Functions) sketch (for reference)

```python
# main.py
import json
from google.cloud import logging as cloud_logging

client = cloud_logging.Client()
logger = client.logger("pos-application-logs")

def app_logs(request):
    try:
        entry = request.get_json(force=True)
        severity = entry.get("severity", "INFO")
        labels = entry.get("labels", {})
        # Write structured log
        logger.log_struct(entry, severity=severity, labels=labels)
        return (json.dumps({"ok": True}), 200, {"Content-Type": "application/json"})
    except Exception as e:
        return (json.dumps({"ok": False, "error": str(e)}), 400, {"Content-Type": "application/json"})
```

Deploy this as an HTTP function named `app_logs` (or Cloud Run with URL above) and set `environment.cloudLoggingEndpoint` to its URL. If you require an API key, set `environment.cloudLoggingApiKey` and the client will send it in `X-API-Key`.

## UI configuration

- `environment.ts` and `environment.prod.ts` now include `cloudLoggingEndpoint`. Set this to your Python function URL when deployed.
- The `LoggerService` will POST logs to this endpoint (non-blocking) when it is non-empty.

## Security

- Consider requiring an API key or Firebase App Check token and validate it in the function.
- Limit CORS to your app origin.
- Avoid logging PII; client already sanitizes common sensitive fields.
