import { defineCollection, z } from "astro:content";

const experiences = defineCollection({
    schema: z.object({
      title: z.string(),
      enterprise: z.string(),
      image: z.string().url(),
      technologies: z.string(),
      period: z.string(),
      description: z.string(),
    })
  });

export const collections = { experiences };




/*
bg = [{
    title: {
        en: "Dpagos platform",
        es: "Plataforma Dpagos"
    },
    enterprises: [{
        name: "Billuyo",
        logo: "https://billuyo.com.co/favicon.png",
        link: "https://billuyo.com.co"
    }, {
        name: "Dpagos",
        logo: "https://dpagos-platform-front.vercel.app/logo.svg",
        link: "https://dpagos-platform-front.vercel.app"
    }],
    imgs: ["https://res.cloudinary.com/ddt7qdant/image/upload/v1757945606/Captura_de_pantalla_2025-04-17_155832_l4oywu_befdsq.png", "https://res.cloudinary.com/ddt7qdant/image/upload/v1757945606/Captura_de_pantalla_2025-04-17_155942_sw3cfo_xy7q0t.png", "https://res.cloudinary.com/ddt7qdant/image/upload/v1757945606/Captura_de_pantalla_2025-04-17_160011_bxkqzo_psnbic.png", "https://res.cloudinary.com/ddt7qdant/image/upload/v1757945606/dpagos_uj37xt.png", "https://res.cloudinary.com/ddt7qdant/image/upload/v1757945606/Screenshot_24_xiqgar_hckrzw.png", "https://res.cloudinary.com/ddt7qdant/image/upload/v1757945606/Screenshot_23_ydrxt2_opzixd.png", "https://res.cloudinary.com/ddt7qdant/image/upload/v1757945607/Screenshot_25_k190iv_xgdk3d.png"],
    technologies: ["React", "TypeScript", "Fastapi", "Shadcn", "Recharts", "SQLAlchemy"],
    date: {
        start: {
            month: 3,
            year: "2025"
        },
        end: {
            month: 4,
            year: "2025"
        }
    },
    description: {
        es: "Desarrollé esta plataforma que permite a usuarios puntos de venta vender loteria utilizando el servicio de Billuyo y a un administrador, manejaar puntos de venta, su saldo, sus solicitudes de saldo y demás. Se creó utilizando React con TypeScript para el frontend y FastAPI con SQLAlchemy para el backend. Implementé interfaces modernas con Shadcn, Recharts y Tailwind.",
        en: "I developed this platform that allows users to sell lottery using the Billuyo service and an administrator to manage points of sale, their balance, their balance requests, and more. It was created using React with TypeScript for the frontend and FastAPI with SQLAlchemy for the backend. I implemented modern interfaces with Shadcn, Recharts, and Tailwind."
    }
}, {
    title: {
        es: "Venus AI",
        en: "Venus AI"
    },
    enterprises: [{
        name: "Juan Jose Huertas Botache",
        logo: Sg,
        link: "/"
    }],
    imgs: ["https://res.cloudinary.com/ddt7qdant/image/upload/v1757945608/Screenshot_27_cgskb2_dgvojd.png", "https://res.cloudinary.com/ddt7qdant/image/upload/v1757945608/Screenshot_26_oynq8b_q7hggo.png"],
    technologies: ["Shadcn", "Tailwind", "TypeScript", "Gemini API"],
    date: {
        start: {
            month: 12,
            year: "2024"
        },
        end: {
            month: 12,
            year: "2024"
        }
    },
    description: {
        es: "Este proyecto es un chatbot de IA hecho para responder preguntas sobre una institución educativa. Se desarrolló utilizando Shadcn y la API de Gemini.",
        en: "This project is an AI chatbot designed to answer questions about an educational institution. It was developed using Shadcn and the Gemini API."
    }
}, {
    title: {
        es: "Intellibot",
        en: "Intellibot"
    },
    enterprises: [{
        name: "Juan Jose Huertas Botache",
        logo: Sg,
        link: "/"
    }],
    imgs: ["https://res.cloudinary.com/ddt7qdant/image/upload/v1757945607/Screenshot_2025-04-18_10-42-01_ftuzp4_harlkw.png", "https://res.cloudinary.com/ddt7qdant/image/upload/v1757945607/Screenshot_2025-04-18_10-40-49_lydfoj_tiegtf.png"],
    technologies: ["React"],
    date: {
        start: {
            month: 12,
            year: "2024"
        },
        end: {
            month: 12,
            year: "2024"
        }
    },
    description: {
        es: "Este es un software diseñado para manejar el whatsapp de una empresa. Permite responder preguntas frecuentes, enviar mensajes automáticos y manejar el flujo de conversación con los clientes. En este proyecto, colaboré para agregar nuevas funcionalidades UI y mejorar la experiencia del usuario.",
        en: "This is a software designed to manage a company's WhatsApp. It allows for answering frequently asked questions, sending automatic messages, and managing the flow of conversation with customers. In this project, I collaborated to add new UI functionalities and improve the user experience."
    }
}];
*/
