import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

interface PaymentResponse {
    status: 'APPROVED' | 'REJECTED' | 'ERROR' | 'INSUFFICIENT';
    transactionId?: string;
    errorCode?: string;
    message: string;
    rawResponse?: any;
}

export class PaymentService {
    private static readonly API_URL = 'https://fakepayment.onrender.com';
    private static readonly API_KEY = process.env.FAKE_PAYMENT_API_KEY;

    public static isValidTestCard(cardNumber: string): boolean {
        const testCards = [
            '4111111111111111', // Visa
            '555555555554444',  // Mastercard
            '37828246310005',   // American Express
            '601111111111117',  // Discover
            '3530111333300000', // JCB
            '30569309025904'    // Diners Club
        ];
        return testCards.includes(cardNumber.replace(/\s+/g, ''));
    }

    public static async processPayment(paymentData: {
        amount: number;
        cardNumber: string;
        cvv: string;
        expirationMonth: string;
        expirationYear: string;
        fullName: string;
        currency: string;
        description?: string;
        reference?: string;
    }): Promise<PaymentResponse> {
        try {
            const requestData = {
                amount: paymentData.amount.toFixed(2),
                "card-number": paymentData.cardNumber,
                "cvv": paymentData.cvv,
                "expiration-month": paymentData.expirationMonth.padStart(2, '0'),
                "expiration-year": paymentData.expirationYear,
                "full-name": paymentData.fullName.toUpperCase(),
                currency: paymentData.currency,
                description: paymentData.description?.substring(0, 100) || "Payment",
                reference: paymentData.reference || `ref_${Date.now()}`
            };

            const response = await axios.post(
                `${this.API_URL}/payments`,
                requestData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.API_KEY}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: 5000
                }
            );

            if (response.data.error_code) {
                return this.mapErrorResponse(response.data.error_code);
            }

            return {
                status: 'APPROVED',
                transactionId: response.data.transaction_id,
                message: 'Pago procesado exitosamente',
                rawResponse: response.data
            };
        } catch (error: any) {
            console.error('Payment API Error:', error.response?.data || error.message);
            return this.handleApiError(error);
        }
    }

    private static mapErrorResponse(errorCode: string): PaymentResponse {
        const errorMap: Record<string, PaymentResponse> = {
            '001': { status: 'ERROR', errorCode: '001', message: 'Número de tarjeta inválido' },
            '002': { status: 'REJECTED', errorCode: '002', message: 'Pago rechazado' },
            '003': { status: 'ERROR', errorCode: '003', message: 'Error procesando el pago' },
            '004': { status: 'INSUFFICIENT', errorCode: '004', message: 'Fondos insuficientes' }
        };
        return errorMap[errorCode] || { 
            status: 'ERROR', 
            errorCode: '000', 
            message: 'Error desconocido en el pago' 
        };
    }

    private static handleApiError(error: any): PaymentResponse {
        if (error.response) {
            if (error.response.data?.error_code) {
                return this.mapErrorResponse(error.response.data.error_code);
            }
            return {
                status: 'ERROR',
                errorCode: `HTTP_${error.response.status}`,
                message: error.response.data?.message || 'Error en la solicitud a la API'
            };
        } else if (error.request) {
            return {
                status: 'ERROR',
                errorCode: 'NETWORK',
                message: 'No se recibió respuesta del gateway de pago'
            };
        } else {
            return {
                status: 'ERROR',
                errorCode: 'CONFIG',
                message: 'Error de configuración en la solicitud de pago'
            };
        }
    }
}