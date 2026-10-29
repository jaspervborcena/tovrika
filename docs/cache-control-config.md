# Cache Control for Production Deployment
# Add these headers to your web server (nginx, Apache, or hosting service)

# For Angular application files
location ~* \.(js|css)$ {
    expires 1h;
    add_header Cache-Control "public, must-revalidate";
    add_header ETag "";
}

# For index.html - never cache
location = /index.html {
    expires -1;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
}

# For Firebase Hosting, apply this policy to the app's index.html.
# Hashed Angular bundles can remain cached for a year because each build
# produces new filenames.
{
  "hosting": {
    "headers": [
      {
        "source": "index.html",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          }
        ]
      }
    ]
  }
}