import { Request, Response } from 'express';
import { PaymentModel } from '../models/PaymentModel';
import { PaymentService } from '../services/PaymentService';

export class PaymentsController {
    private model: PaymentModel;

    constructor() {
        this.model = new PaymentModel();
    }

    async processPayment(req: Request, res: Response) {
        try {
            console.log('Incoming payment data:', req.body);
            const ipAddress = req.ip || req.connection.remoteAddress || '';
            
            // Validar campos requeridos
            const requiredFields = ['service', 'email', 'cardName', 'cardNumber', 
                                  'expMonth', 'expYear', 'cvv', 'amount', 'currency'];
            const missingFields = requiredFields.filter(field => !req.body[field]);
            
            if (missingFields.length > 0) {
                return res.redirect(`/form_pay?error=missing_fields&fields=${missingFields.join(',')}`);
            }

            // Validar tarjeta antes de procesar
            if (!PaymentService.isValidTestCard(req.body.cardNumber.replace(/\s+/g, ''))) {
                return res.redirect('/negacion');
            }
            //  Ahora si sirveeeeee
            // Procesar pago
            const apiResponse = await PaymentService.processPayment({
                amount: parseFloat(req.body.amount),
                cardNumber: req.body.cardNumber.replace(/\s+/g, ''),
                cvv: req.body.cvv,
                expirationMonth: req.body.expMonth,
                expirationYear: req.body.expYear,
                fullName: req.body.cardName,
                currency: req.body.currency.toUpperCase(),
                description: `Service: ${req.body.service}`,
                reference: `user:${req.body.email}`
            });

            // Manejar respuesta
            if (apiResponse.status !== 'APPROVED') {
                return this.handlePaymentError(res, apiResponse);
            }

            // Guardar en base de datos
            const paymentId = await this.model.createPayment({
                service: req.body.service,
                email: req.body.email,
                cardName: req.body.cardName,
                cardNumber: req.body.cardNumber,
                expMonth: parseInt(req.body.expMonth),
                expYear: parseInt(req.body.expYear),
                cvv: req.body.cvv,
                amount: parseFloat(req.body.amount),
                currency: req.body.currency,
                ipAddress: ipAddress,
                transactionId: apiResponse.transactionId,
                status: apiResponse.status
            });

            res.redirect(`/confirmacion`);
        } catch (error) {
            console.error('Payment processing error:', error);
            res.redirect('/payment/error/server-error');
        }
    }

    async listPayments(req: Request, res: Response) {
        try {
            const payments = await this.model.getAllPayments();
            res.render('paymentlist', { 
                payments,
                formatCard: (cardNumber: string) => cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ')
            });
        } catch (error) {
            console.error('Error listing payments:', error);
            res.status(500).render('error', {
                message: 'Error loading payment history'
            });
        }
    }

    private handlePaymentError(res: Response, apiResponse: any) {
        const errorViewData = {
            message: apiResponse.message,
            errorCode: apiResponse.errorCode,
            suggestion: this.getErrorSuggestion(apiResponse.errorCode)
        };
        return res.status(400).render('payment-error', errorViewData);
    }

    private getErrorSuggestion(errorCode: string): string {
        const suggestions: Record<string, string> = {
            '001': 'Por favor use una de nuestras tarjetas de prueba',
            '002': 'Contacte a su banco o pruebe otro método de pago',
            '003': 'Intente nuevamente más tarde o contacte soporte',
            '004': 'Verifique el saldo de su cuenta o use otra tarjeta'
        };
        return suggestions[errorCode] || 'Por favor intente nuevamente o contacte soporte';
    }
}