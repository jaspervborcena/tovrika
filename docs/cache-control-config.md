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

# For Firebase hosting, add to firebase.json:
{
  "hosting": {
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=3600, must-revalidate"
          }
        ]
      },
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