# GiftCard Shop Backend

## Requirements

    $ node --version
    v18.19.1

    $ npm --version
    10.2.3

    $ MongoDB
    7.0

## Install

    $ git clone https://github.com/amadeus-b/giftcard-backend.git
    $ cd giftcard-backend
    $ npm install

## Configure app

    add .env file to the project folder

## Running the project

    $ npm start

## Deployment

### Local Environment

    $ npm install
    $ npm install -g typescript
    $ npm run build
    $ node dist/app.js

## Database

Run seeders using below commands

    $ node dist/database/seeders/tax_types.js
    $ node dist/database/seeders/shop.js
    $ node dist/database/seeders/user_settings.js
