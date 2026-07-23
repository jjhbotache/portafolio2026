---
title:
  es: Surebets Bettor
  en: Surebets Bettor
img: /projects/imgs/surebetsBettor.jpeg
importance: 2
technologies:
  es:
    - Python
    - React
    - requests
    - beautiful soup
    - sqlite
    - pywebview
    - Recharts
    - React Router DOM
  en:
    - Python
    - React
    - requests
    - beautiful soup
    - sqlite
    - pywebview
    - Recharts
    - React Router DOM
video: https://res.cloudinary.com/ddt7qdant/video/upload/v1757945609/surebetsBettorVideo_reducido_z1ba0f_tsvcsh.mp4
links:
  - label:
      es: Repositorio
      en: Repository
    url: https://github.com/jjhbotache/bets_gettor
  - label:
      es: Demo
      en: Demo
    url: https://bets-gettor.vercel.app/
description:
  es: |
    Esta aplicacion de escritorio, analiza mediante web scraping, 3 casas de apuestas y apartir de esa información, encuentra surebets: Apuestas seguras, que al apostar a todos eventos posibles, se obtendrá igual, una ganancia. El programa se escribió en Python y usa, para la interfaz gráfica, React mediante la librería pywebview, para con Recharts, mostrar gráficos de la información. Con respecto a Python, se usó request, beautiful soup para hacer web scraping y sqlite para almacenar información de las surebets registradas. La preview que puedes ver abajo, es solo la interfaz desplegada, asi que no escrapeará información.
  en: |
    This desktop application, analyzes by web scraping, 3 bookmakers and from that information, finds surebets: sure bets, that when betting on all possible events, you will get the same, a profit. The program was written in Python and uses, for the graphical interface, React through the pywebview library, to display graphs of the information with Recharts. With respect to Python, we used request, beautiful soup for web scraping and sqlite to store information of the registered surebets. The preview you can see below, is only the displayed interface, so it will not scrape information.
content:
  es: |
    Aplicación de escritorio que analiza 3 casas de apuestas mediante **web scraping**
    para encontrar **surebets**: apuestas seguras que, al cubrirlas todas, dejan ganancia.

    ## Cómo funciona

    - **Scraping**: con `requests` y `Beautiful Soup` se extraen los eventos y cuotas
      de cada casa de apuestas.
    - **Análisis**: se agrupan los eventos equivalentes y se calcula si la combinación
      cumple la condición de surebet.
    - **Persistencia**: las surebets detectadas se guardan en una base **SQLite**.
    - **Interfaz**: la UI se construye en **React** y se embebe en la app de escritorio
      usando **pywebview**, con **Recharts** para los gráficos.

    > La preview sólo muestra la interfaz desplegada; no se ejecuta el scraping en vivo.
  en: |
    Desktop application that analyzes 3 bookmakers via **web scraping** to find
    **surebets**: safe bets that, when covering every outcome, still yield a profit.

    ## How it works

    - **Scraping**: `requests` and `Beautiful Soup` extract events and odds from each
      bookmaker.
    - **Analysis**: equivalent events are grouped and the app checks if the combination
      satisfies the surebet condition.
    - **Persistence**: detected surebets are stored in a **SQLite** database.
    - **Interface**: the UI is built with **React** and embedded into the desktop app via
      **pywebview**, with **Recharts** for charts.

    > The preview only shows the deployed interface; live scraping is not run there.
---

Aplicación de escritorio que analiza casas de apuestas para encontrar surebets.