import { Request, Response } from 'express';
import axios from 'axios';
import { ContactsModel } from '../models/ContactsModel';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

interface RecaptchaResponse {
    success: boolean;
    challenge_ts: string;
    hostname: string;
    'error-codes'?: string[];
}

interface GeoResponse {
    status?: string;
    message?: string;
    country?: string;
}

interface IpInfoResponse {
    country?: string;
}

export class ContactsController {
    private model: ContactsModel;
    private transporter: nodemailer.Transporter;
    private emailRecipients: string[];

    constructor() {
        // Verificar variables de entorno requeridas
        this.validateEnvVariables();
        
        this.model = new ContactsModel();
        this.emailRecipients = process.env.EMAILDESTINO?.split(',') || [];
        
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD
            },
            tls: {
                rejectUnauthorized: process.env.NODE_ENV === 'production'
            }
        });
    }

    private validateEnvVariables(): void {
        const requiredVars = ['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'CONTRARECAPTCHA'];
        const missingVars = requiredVars.filter(varName => !process.env[varName]);

        if (missingVars.length > 0) {
            throw new Error(`Faltan variables de entorno requeridas: ${missingVars.join(', ')}`);
        }
    }

    private async sendNotificationEmail(contactData: {
        name: string;
        email: string;
        comment: string;
        ipAddress: string;
        country: string;
        date: string;
    }): Promise<void> {
        if (this.emailRecipients.length === 0) {
            console.warn('No hay destinatarios configurados para el correo');
            return;
        }

        try {
            await this.transporter.verify();
            
            const mailOptions = {
                from: `"Formulario de Contacto" <${process.env.GMAIL_USER}>`,
                to: this.emailRecipients.join(', '),
                subject: 'Nuevo formulario completado',
                html: `
                    <h1>Nuevo formulario recibido</h1>
                    <p><strong>Nombre:</strong> ${contactData.name}</p>
                    <p><strong>Email:</strong> ${contactData.email}</p>
                    <p><strong>Comentario:</strong> ${contactData.comment}</p>
                    <p><strong>Dirección IP:</strong> ${contactData.ipAddress}</p>
                    <p><strong>País:</strong> ${contactData.country}</p>
                    <p><strong>Fecha/Hora:</strong> ${contactData.date}</p>
                `
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('Correo enviado:', info.messageId);
        } catch (error) {
            console.error('Error al enviar correo:', error);
            throw new Error('Falló el envío del correo de notificación');
        }
    }

    private async getCountryFromIp(ipAddress: string): Promise<string> {
        if (!ipAddress || ipAddress === "127.0.0.1" || ipAddress === "::1") {
            return 'Localhost';
        }

        try {
            // Primero intentamos con ip-api.com
            const geoResponse = await axios.get<GeoResponse>(`https://ip-api.com/json/${ipAddress}`);
            
            if (geoResponse.data.status === "success" && geoResponse.data.country) {
                return geoResponse.data.country;
            }

            // Si falla, intentamos con ipinfo.io
            const fallbackResponse = await axios.get<IpInfoResponse>(`https://ipinfo.io/${ipAddress}/json`);
            return fallbackResponse.data.country || 'Desconocido';
        } catch (error) {
            console.error('Error al obtener país:', error);
            return 'Desconocido';
        }
    }

    async add(req: Request, res: Response): Promise<void> {
        try {
            // Validar reCAPTCHA
            const recaptchaToken = req.body['g-recaptcha-response'];
            if (!recaptchaToken) {
                throw new Error('Token reCAPTCHA no proporcionado');
            }

            // Verificación reCAPTCHA
            const verificationResponse = await axios.post<RecaptchaResponse>(
                'https://www.google.com/recaptcha/api/siteverify',
                new URLSearchParams({
                    secret: process.env.CONTRARECAPTCHA || '',
                    response: recaptchaToken,
                    remoteip: req.ip || ''
                }).toString(),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            if (!verificationResponse.data.success) {
                const errorCodes = verificationResponse.data['error-codes']?.join(', ') || 'desconocido';
                console.error('Error reCAPTCHA:', errorCodes);
                throw new Error('Verificación reCAPTCHA fallida');
            }

            // Obtener IP del cliente
            let ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            if (Array.isArray(ipAddress)) {
                ipAddress = ipAddress[0];
            }
            ipAddress = ipAddress?.toString().split(',')[0].trim() || '';

            // Obtener país
            const country = await this.getCountryFromIp(ipAddress);

            // Datos del contacto
            const contactData = {
                email: req.body.email,
                name: req.body.name,
                comment: req.body.comment,
                ipAddress: ipAddress,
                country: country,
                date: new Date().toLocaleString('es-ES', {
                    timeZone: 'America/Mexico_City',
                    dateStyle: 'full',
                    timeStyle: 'long'
                })
            };

            // Guardar en base de datos
            await this.model.addContact(contactData);

            // Enviar notificación por correo
            await this.sendNotificationEmail(contactData);

            res.redirect('/confirmacion');
        } catch (error) {
            console.error('Error en el formulario:', error);
            res.status(500).render('error', {
                message: error instanceof Error ? error.message : 'Ocurrió un error inesperado'
            });
        }
    }

    async list(req: Request, res: Response): Promise<void> {
        try {
            const contacts = await this.model.getAllContacts();
            res.render('contactlist', { contacts });
        } catch (error) {
            console.error('Error al listar contactos:', error);
            res.status(500).render('error', {
                message: 'Error al cargar la lista de contactos'
            });
        }
    }
}