---
title:
  es: Prematch surebets gettor
  en: Prematch surebets gettor
img: /projects/imgs/prematch_bettor.gif
importance: 4
technologies:
  es:
    - Python
    - Beautiful Soup
    - pyTelegramBotAPI
  en:
    - Python
    - Beautiful Soup
    - pyTelegramBotAPI
video: https://res.cloudinary.com/ddt7qdant/video/upload/v1757945609/simplescreenrecorder-2024-08-14_11.26.20-ezgif.com-video-to-gif-converter_iugz1t_aql62q.mp4
links:
  - label:
      es: Repositorio
      en: Repository
    url: https://github.com/jjhbotache/prematch_bettor
  - label:
      es: Chatbot de Telegram
      en: Telegram Chatbot
    url: https://t.me/PreSureBetbot
description:
  es: |
    Este es un bot, que busca surebets en 3 casas de apuestas: wplay, betplay y codere. Analiza los eventos de futbol de cada una de las casas de apuestas y agrupa los mismos eventos, para luego ver si existe una surebet. Si es asi, la envia a todos los que esten suscritos al bot de telegram!
  en: |
    This is a bot, that looks for surebets in 3 bookmakers: wplay, betplay and codere. It analyzes the soccer events of each of the bookmakers and groups the same events, to then see if there is a surebet. If so, it sends it to everyone subscribed to the telegram bot!
content:
  es: |
    Bot que monitorea **3 casas de apuestas** (Wplay, Betplay y Codere) en busca de
    **surebets pre-partido** de fútbol y las difunde por Telegram.

    ## Flujo

    - **Scraping** de eventos y cuotas con **Beautiful Soup**.
    - Los eventos equivalentes entre casas se **agrupan** para compararlos.
    - Si la combinación cumple la condición de surebet, se **publica** automáticamente
      en el bot de Telegram.

    Los suscriptores reciben las alertas en tiempo real en su chat.
  en: |
    A bot that monitors **3 bookmakers** (Wplay, Betplay and Codere) searching for
    **pre-match soccer surebets** and broadcasts them on Telegram.

    ## Flow

    - **Scraping** of events and odds with **Beautiful Soup**.
    - Equivalent events across bookmakers are **grouped** to compare them.
    - When a combination satisfies the surebet condition, it is automatically
      **published** to the Telegram bot.

    Subscribers get the alerts in real time in their chat.
---

Bot de surebets pre-partido en fútbol que avisa por Telegram.