// firebase-tools refuse un fichier de règles hors du dossier du projet : on en place une copie ici (ignorée par git) avant de lancer l'émulateur.
import fs from 'node:fs';
fs.copyFileSync(new URL('../database.rules.json', import.meta.url), new URL('./database.rules.json', import.meta.url));
