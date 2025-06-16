# Telegram Bot Template

A Telegram bot template built with NestJS and Telegraf.

## 🚀 About

This template provides a foundation for building Telegram bots that can handle pretty much any bot related need. It's designed to be easily customizable for various use cases.

## 🛠 Features

- **User Management**
  - Automated user verification
  - User registration and tracking
  - Role-based access control

- **Community Features**
  - Broadcast messaging
  - Custom command handling
  - AI-powered responses

## 🛠 Tech Stack

- NestJS
- Telegraf (Telegram Bot Framework)
- PostgreSQL with Knex.js
- OpenAI Integration
- Docker Support

## 📋 Prerequisites

- Node.js v22
- Docker
- Telegram Bot Token
- OpenAI API Key

## 🚀 Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/telegram-bot-template.git
cd telegram-bot-template
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

## 📝 Customization

1. Update the bot configuration in `.env`
2. Modify the command handlers in `src/commands`
3. Customize the database schema in `src/database/migrations`
4. Add your own features and integrations
