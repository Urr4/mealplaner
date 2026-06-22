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

## Schnellstart (frische Installation)

```bash
git clone <repo-url> ~/mealplaner
cd ~/mealplaner
chmod +x setup.sh
./setup.sh
```

Das Skript erledigt automatisch:
1. Docker und NFS-Tools installieren
2. NFS-Share mounten und in `/etc/fstab` eintragen
3. NAS-Verzeichnisse anlegen und Berechtigungen setzen
4. Docker-Image bauen (ARM64 für Raspberry Pi)
5. Stack deployen

**Erreichbar unter: `http://pi1:3001`**

---

## Nach Code-Änderungen neu deployen

```bash
cd ~/mealplaner
git pull
./redeploy.sh
```

`redeploy.sh` baut das Image neu und deployt den Stack idempotent (funktioniert auch beim ersten Mal).

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
Benutzername: `mealplaner` / Passwort: `***REMOVED***`

---

## Daten zurücksetzen

```bash
./setup.sh --wipe-db       # Datenbank löschen (alle Rezepte, Wochenplan, Einstellungen)
./setup.sh --wipe-minio    # Alle Bilder löschen
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
git clone <repo-url> ~/mealplaner
cd ~/mealplaner
./setup.sh   # Daten bereits auf der NAS vorhanden — kein Verlust
```

---

## Docker Swarm — Hinweise

- **Netzwerk `internal`**: Internes Stack-Netzwerk, nur für die Kommunikation zwischen App und MinIO
- **Ports**: App auf 3001, MinIO nutzt 9002 (API) und 9003 (Konsole). Kein Konflikt mit taster (nutzt 80, 443, 3000)
- **SQLite auf NFS**: `noac`-Option verhindert inkonsistente Lesevorgänge

