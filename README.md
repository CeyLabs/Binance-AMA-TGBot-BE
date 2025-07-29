# Binance MENA AMA Telegram Bot

A Telegram bot built with NestJS and Telegraf to manage AMAs for MENA region groups.

## 🚀 About

This bot is specifically designed to manage and automate AMA (Ask Me Anything) sessions for Binance MENA region Telegram groups. It helps streamline the AMA process, manage participant interactions, Create reward leaderboards, and ensure smooth communication during these sessions.

## 🛠 Features

- **AMA Management**
  - Automated AMA session scheduling
  - Question collection and moderation
  - Real-time participant tracking

- **User Management**
  - Participant registration for AMAs
  - User verification and tracking
  - Admin roles with `super_admin`, `admin`, and `regular`

## 🛠 Tech Stack

- NestJS
- Telegraf (Telegram Bot Framework)
- PostgreSQL with Knex.js
- Docker Support

## 📋 Prerequisites

- Node.js v22
- Docker
- Telegram Bot Token

## 🚀 Installation

1. Clone the repository:
```bash
git clone https://github.com/CeyLabs/Binance-AMA-TGBot-BE.git
cd Binance-AMA-TGBot-BE
```

2. Create `.env` file:
```bash
cp .env.example .env
# Update .env file with your configuration
```

3. Install dependencies:
```bash
npm install
```

4. Start the PostgreSQL database using Docker:
```bash
docker-compose up -d
```

5. Run database migrations:
```bash
npm run migrate
npm run fixtures
```

6. Start the development server:
```bash
npm run serve:local
```

## 🤖 Bot Commands

### **Admin Commands**
- `/newama <language> <sessionNo>` - Create new AMA session (interactive setup)
- `/startama <sessionNo>` - Start an AMA session
- `/endama <sessionNo>` - End an AMA session
- `/selectwinners <sessionNo>` - Select winners for completed AMA
- `/help` - Display help information

### **User Role Management Commands** (Super Admin Only)
- `/grantadmin <user_id>` - Grant full admin privileges
- `/grantedit <user_id>` - Grant edit permissions (edit announcements, start/end AMAs, select winners)
- `/grantnew <user_id>` - Grant basic AMA access (start/end AMAs, select winners only)
- `/grantregular <user_id>` - Demote user to regular (remove all bot access)

### **User Commands**
- `/start` - General bot start command
- `/start subscribe_en` - Subscribe to English AMA notifications
- `/start subscribe_ar` - Subscribe to Arabic AMA notifications
- `/start claim_<token>` - Claim reward (for winners only)

### **Question Participation**
- Use hashtags in public groups to participate:
  - English AMAs: `#BinanceSession` 
  - Arabic AMAs: `#جلسات_بينانس`

## Admin Management

Use the role management commands to assign specific permissions to users. When replying to a user's message, the quoted user will also be granted the role without specifying an ID. All role management commands can only be executed by `super_admin` users.

**Role Hierarchy:**
- `super_admin` - Full access to all features and user management
- `admin` - Full AMA management access (create, edit, start, end, select winners, broadcast)
- `admin_edit` - Can edit announcements, start/end AMAs, and select winners
- `admin_new` - Can start/end AMAs and select winners (no creation or editing)
- `regular` - No bot management access (can only participate in AMAs)

User name and username fields are automatically kept in sync with Telegram when any command or AMA question is received.
