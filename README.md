# Mealplaner

Eine selbst-gehostete Wochenplan-App für die Familie.

## Übersicht

```
LAN  ──►  Port 3001
           mealplaner-app (Node/Express)
                │
           SQLite  (NFS — Synology NAS)
           MinIO   (NFS — Synology NAS)  ← Rezept-Bilder
                │ optional
           Ollama  (http://Stefans-PC:11434)  ← Desktop-PC
```

---

## Funktionen

| Feature | Details |
|---------|---------|
| **Rezepte** | Erstellen, bearbeiten, löschen mit Name, Beschreibung, Bild, Zutaten, Schritt-für-Schritt-Anleitung |
| **Vorlieben** | Haushaltsmitglieder anlegen und pro Rezept „mag es" / „mag es nicht" markieren |
| **Diktat** | Rezept grob diktieren → Ollama strukturiert es in ein lesbares Rezept |
| **Wochenplan** | Konfigurierbare Anzahl Mahlzeiten (Standard 4), Bedingungen wie „3 Gerichte gemocht von Mila" |
| **Austauschen** | Einzelne Mahlzeiten per Knopfdruck austauschen |
| **Einkaufsliste** | Alle Zutaten der geplanten Mahlzeiten aggregiert — direkt unter dem Wochenplan |
| **Persistenter Plan** | Wochenplan bleibt gespeichert bis „Plan erstellen" erneut geklickt wird |
| **Einstellungen** | Ollama-URL und Modelle direkt in der App konfigurieren |

---

## Infrastruktur

| Komponente | Details |
|------------|---------|
| **Raspberry Pi Swarm** | Pi1 = Manager |
| **Synology NAS** | `192.168.178.62` — NFS-Share `/volume1/cloudstorage` |
| **Desktop-PC** | Ollama unter `http://Stefans-PC:11434` |

> Mealplaner ist eine reine LAN-App — kein Traefik, kein HTTPS, kein externer Zugriff nötig.

---

## NAS-Verzeichnisse anlegen (einmalig)

Auf der Synology NAS müssen diese Ordner im Pfad `docker-swarm-data` existieren:

```
docker-swarm-data/
  mealplaner/          ← SQLite-Datenbank (Rezepte, Wochenplan, Einstellungen)
  minio/
    mealplaner/        ← Rezept-Bilder (MinIO)
```

**Auf Pi1 ausführen** (setzt auch die nötigen Berechtigungen):

```bash
sudo mkdir -p /volume1/cloudstorage/docker-swarm-data/mealplaner
sudo mkdir -p /volume1/cloudstorage/docker-swarm-data/minio/mealplaner
sudo chmod 777 /volume1/cloudstorage/docker-swarm-data/mealplaner
sudo chmod 777 /volume1/cloudstorage/docker-swarm-data/minio/mealplaner
```

> **Hinweis:** Synology `root_squash` mappt Container-Root auf `nobody`. Deshalb müssen Berechtigungen vom Pi aus per `sudo` gesetzt werden — Container selbst können das nicht.

---

## Deployment (automatisch)

Jeder Push auf `main` baut per GitHub Actions ein ARM64-Image und legt es als
`ghcr.io/urr4/mealplaner:latest` ab. **Shepherd** auf dem Pi erkennt das neue Image
und aktualisiert den Service von selbst — manuelles Bauen oder Deployen ist nicht nötig.

### Einmalige Einrichtung auf Pi1

1. NFS-Share und NAS-Verzeichnisse wie oben beschrieben anlegen.
2. Secrets-Datei anlegen (liegt nur auf dem Pi, nie im Repo):

```bash
mkdir -p ~/secrets && chmod 700 ~/secrets
printf 'MINIO_ACCESS_KEY=mealplaner\nMINIO_SECRET_KEY=<starkes-passwort>\n' > ~/secrets/mealplaner.env
chmod 600 ~/secrets/mealplaner.env
```

3. Stack deployen:

```bash
cd ~/mealplaner && git pull
set -a; . ~/secrets/mealplaner.env; set +a
docker stack deploy --with-registry-auth -c docker-compose.yml mealplaner
```

Dieser Schritt ist nur beim ersten Mal und nach Änderungen an `docker-compose.yml` nötig.
Den Shepherd-Stack gibt es im Repo `taster` (Ordner `shepherd/`).

Rollback auf eine ältere Version:
`docker service update --image ghcr.io/urr4/mealplaner:sha-<commit> mealplaner_app`
(danach das Label/Tag wieder auf `latest` stellen oder Shepherd kurz pausieren).

---

## Lokale Entwicklung

```bash
./dev.sh
```

Startet:
- **Backend** auf `http://localhost:3001` (Auto-Reload)
- **Frontend** auf `http://localhost:5173` (Vite HMR)

Im Dev-Modus:
| Komponente | Dev-Verhalten |
|------------|---------------|
| **SQLite** | `data/dev.db` im Projektverzeichnis |
| **Bilder** | Lokal in `data/images/` (kein MinIO nötig) |
| **Ollama** | `http://localhost:11434` |

---

## Logs und Debugging

```bash
docker stack ps mealplaner               # Service-Status
docker service logs mealplaner_app       # App-Logs
docker service logs mealplaner_minio     # MinIO-Logs
```

MinIO-Konsole (Web-UI): `http://pi1:9003`  
Benutzername und Passwort stehen in `~/secrets/mealplaner.env` auf dem Pi.

---

## Daten zurücksetzen

```bash
# Datenbank löschen (alle Rezepte, Wochenplan, Einstellungen)
docker service scale mealplaner_app=0
sudo rm -rf /volume1/cloudstorage/docker-swarm-data/mealplaner/*
docker service scale mealplaner_app=1

# Alle Bilder löschen
sudo rm -rf /volume1/cloudstorage/docker-swarm-data/minio/mealplaner/*
docker service update --force mealplaner_minio
```

---

## Ollama einrichten (Desktop-PC)

Ollama muss so konfiguriert sein, dass er Netzwerkanfragen akzeptiert:

**Windows** (PowerShell):
```powershell
[System.Environment]::SetEnvironmentVariable("OLLAMA_HOST", "0.0.0.0:11434", "Machine")
# Ollama neu starten
```

**macOS:**
```bash
launchctl setenv OLLAMA_HOST "0.0.0.0:11434"
# Ollama neu starten
```

Modelle werden beim App-Start automatisch heruntergeladen, falls noch nicht vorhanden.

---

## Recovery

Da SQLite und MinIO-Daten auf der NAS liegen, gehen bei einem Pi-Ausfall keine Daten verloren:

```bash
git clone git@github.com:Urr4/mealplaner.git ~/mealplaner
# Secrets-Datei ~/secrets/mealplaner.env neu anlegen, dann Stack deployen (siehe „Deployment")
```

---

## Docker Swarm — Hinweise

- **Netzwerk `internal`**: Internes Stack-Netzwerk, nur für die Kommunikation zwischen App und MinIO
- **Ports**: App auf 3001, MinIO nutzt 9002 (API) und 9003 (Konsole). Kein Konflikt mit taster (nutzt 80, 443, 3000)
- **SQLite auf NFS**: `noac`-Option verhindert inkonsistente Lesevorgänge

