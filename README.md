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

## Admin Management

Use `/grantadmin <tg_userid>` to promote a user to admin and `/revokeadmin <tg_userid>` to remove admin privileges. When replying to a user's message, the quoted user will also be granted or revoked without specifying an ID. These commands can only be executed by `super_admin` users.
User name and username fields are automatically kept in sync with Telegram when any command or AMA question is received.
