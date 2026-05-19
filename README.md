# ExpenseFlow - Sistema de Gestion de Gastos

Sistema premium de gestion de gastos con bot de WhatsApp y dashboard web en tiempo real.

## Caracteristicas

- **WhatsApp Bot**: Recibe receipts e invoices, procesa con Gemini AI
- **QR Login**: Autenticacion via WhatsApp (tu numero es la clave)
- **Dashboard en Tiempo Real**: Actualizacion inmediata sin refresh
- **Diseño Premium**: Estilo corporativo minimalista tipo VIP demo

## Requisitos

- Node.js >= 20
- WhatsApp (para escanear QR y enviar receipts)
- API Key de Google Gemini

## Configuracion

1. Edita el archivo `.env` y agrega tu API key de Gemini:

```
GEMINI_API_KEY=tu_api_key_aqui
```

Para obtener una API key:
1. Ve a https://aistudio.google.com/app/apikey
2. Crea una nueva API key
3. Copiala al archivo `.env`

## Ejecucion

```bash
npm start
```

El servidor iniciara en `http://localhost:3000`

## Flujo de Uso

### 1. Conexion WhatsApp
- Al iniciar, aparecera un QR en la terminal
- Abre WhatsApp > Dispositivos vinculados > Vincula un dispositivo
- Escanea el QR para conectar el bot

### 2. Login al Dashboard
- Abre `http://localhost:3000` en tu navegador
- Veras un codigo QR
- Escanealo con WhatsApp y envia el mensaje con el codigo
- Automatically te llevara al dashboard

### 3. Enviar Receipts
- Envia una foto de un recibo/factura al numero de WhatsApp vinculado
- El bot processa la imagen con Gemini AI
- Automatically aparece en el dashboard en tiempo real

### 4. Ver Gastos
- Escribe "gastos" en WhatsApp para ver resumen
- El dashboard muestra todos los receipts processados

## Comandos de WhatsApp

- `login <token>` - Iniciar sesion (usado automaticamente)
- Foto de receipt - Processar y guardar
- `gastos` - Ver resumen de expenses
- Cualquier otro mensaje - Menu de ayuda

## Estructura del Proyecto

```
/Factura
├── server.js              # Servidor principal Express + Socket.IO
├── package.json           # Dependencias
├── .env                   # Variables de entorno (crear)
├── public/
│   └── index.html         # Dashboard web
└── src/
    ├── whatsapp.js        # Conexion Baileys
    ├── messageHandler.js  # Procesamiento de mensajes
    └── receiptProcessor.js # Integracion Gemini AI
```

## Notas Importantes

- **Advertencia**: Baileys no es oficial. Usa un numero de prueba.
- La sesion de WhatsApp se guarda en `auth_info_baileys/`
- No elimines esa carpeta o tendras que re-escanear el QR
- Agrega `auth_info_baileys/` y `.env` al `.gitignore`

## Solucion de Problemas

- **QR no aparece**: Verifica que Node.js sea >= 20
- **Sesion expirada**: Borra `auth_info_baileys/` y reinicia
- **Error de Gemini**: Verifica tu API key en `.env`
- **Mensajes no llegan**: El bot debe estar conectado (verifica terminal)