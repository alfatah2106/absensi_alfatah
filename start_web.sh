#!/bin/bash
# Buka pada http://192.168.1.12:8080/
# Perintah untuk menjalankan Python Simple HTTP Server di port 8080
# Server akan melayani konten dari direktori tempat script ini dijalankan.
# Menjalankan perintah di jendela terminal XFCE baru
xfce4-terminal --hold --title="Python Server 8080" --command="python3 -m http.server 8080"
