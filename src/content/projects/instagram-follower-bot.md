---
title:
  es: Instagram follower bot
  en: Instagram follower bot
img: /projects/imgs/memorable_instabot_flowchar.png
importance: 4
technologies:
  es:
    - GCP
    - Python
    - Selenium
    - Google gemini
  en:
    - GCP
    - Python
    - Selenium
    - Google gemini
video: MdbcrJJWa5g
links:
  - label:
      es: Repositorio
      en: Repository
    url: https://github.com/jjhbotache/memorable_insta_bot
description:
  es: Este es un proyecto muy interesante, ya que se trata de un bot que sigue a los seguidores de una cuenta de Instagram. Dadas unas cuentas objetivo, el bot sigue a los seguidores de estas cuentas, con un criterio que se puede configurar. Ya que Instagram tiene ciertas restricciones, el bot, aleatoriamente revisa el feed de instagram y tambien la mira con criterio, ignorando el contenido que no cumpla con el criterio. Los criterios son evaluados mediante IA, para tener un feed personalizado y seguir cuentas idoneas.
  en: This is a very interesting project, as it is a bot that follows the followers of an Instagram account. Given some target accounts, the bot follows the followers of these accounts, with a criteria that can be configured. Since Instagram has certain restrictions, the bot randomly goes through the instagram feed and also looks at it with criteria, ignoring content that does not meet the criteria. The criteria are evaluated by AI, to have a personalized feed and follow suitable accounts.
content:
  es: |
    Bot que automatiza el seguimiento de seguidores de cuentas de Instagram objetivo,
    con filtrado inteligente mediante IA.

    ## Cómo funciona

    - **Selenium** controla el navegador para revisar el feed y la lista de seguidores.
    - **Google Gemini** evalúa el contenido del feed frente al criterio configurado.
    - El bot **aleatoriza** su navegación para esquivar las restricciones de Instagram.
    - Sólo se siguen cuentas que **superan el criterio**.

    ## Configuración

    - Cuentas objetivo.
    - Criterio personalizable evaluado por IA (estilo, temática, idioma, etc.).

    Desplegado en **Google Cloud Platform**.
  en: |
    A bot that automates following the followers of target Instagram accounts, with
    intelligent filtering powered by AI.

    ## How it works

    - **Selenium** drives the browser to scroll through the feed and follower lists.
    - **Google Gemini** evaluates the feed content against the configured criteria.
    - The bot **randomizes** its navigation to dodge Instagram restrictions.
    - Only accounts that **meet the criteria** are followed.

    ## Configuration

    - Target accounts.
    - Customizable criteria evaluated by AI (style, topic, language, etc.).

    Deployed on **Google Cloud Platform**.
---

Bot para Instagram con filtrado por IA desplegado en Google Cloud Platform.