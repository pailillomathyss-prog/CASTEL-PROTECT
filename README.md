# 🛡️ CASTEL PROTECT

Bot Discord de modération avec anti-lien persistant, ban, unban, mute, unmute, clear et Smash or Pass.

## 🚀 Installation

```bash
git clone https://github.com/pailillomathyss-prog/CASTEL-PROTECT.git
cd CASTEL-PROTECT
npm install
cp .env.example .env
# Remplis DISCORD_TOKEN dans .env
npm start
```

## ⚙️ Configuration `.env`

```env
DISCORD_TOKEN=ton_token_ici
PREFIX=!
```

## 🤖 Commandes

### 🔗 Anti-lien (persistant — survit aux redémarrages)

| Commande | Description |
|----------|-------------|
| `!antilink on` | Activer l'anti-lien |
| `!antilink off` | Désactiver |
| `!antilink status` | État actuel |

### 🔨 Modération

| Commande | Description |
|----------|-------------|
| `!ban @user [raison]` | Bannir |
| `!unban <ID> [raison]` | Débannir |
| `!mute @user [durée] [raison]` | Timeout (10m, 2h, 1d…) |
| `!unmute @user` | Retirer le timeout |
| `!clear [nombre]` | Supprimer des messages (illimité si vide) |

### 🎮 Fun

| Commande | Description |
|----------|-------------|
| `!sop` | Smash or Pass aléatoire (30s de vote, boutons) |
| `!sop <sujet>` | Smash or Pass sur un sujet personnalisé |

## 📋 Permissions Discord requises

- **Intents** : Message Content, Server Members
- **Permissions bot** : Ban Members, Moderate Members, Manage Messages, Send Messages, Embed Links, Use External Emojis
