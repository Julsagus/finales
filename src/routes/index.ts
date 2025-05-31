import express, { Request, Response } from 'express';
import { ContactsController } from '../controllers/ContactsController';
import { PaymentsController } from '../controllers/PaymentControler';

const router = express.Router();
const controllerContacts = new ContactsController();
const controllerPayment = new PaymentsController();

router.get('/', (req: Request, res: Response) => {
  res.render('index', { nombre: 'Diego', apellido: 'Duarte', cedula:'27131521',seccion:'4',title:'Hola mundooo' });
});

router.get('/menu', (req: Request, res: Response) => {
  res.render('menu', { title: 'Menú' });
});

router.get('/informacion', (req: Request, res: Response) => {
  res.render('informacion', { title: 'informacion' });
});

router.get('/contact', (req: Request, res: Response) => {
  res.render('ordenes', { 
    title: 'ordenes', 
    succes: req.query.succes
  });
});

router.get('/payment', (req, res) => {
  res.render('payment');
});

router.get('/error', (req, res) => {
  res.render('error');
});

router.get('/exito', (req, res) => {
  res.render('exito');
});

router.post('/payment/add', controllerPayment.processPayment.bind(controllerPayment));

router.get('/admin/paymentlist', controllerPayment.listPayments.bind(controllerPayment));

router.get('/confirmacion', (req: Request, res: Response) => {
  res.render('confirmacion', { title: 'informacion' });
});

router.get('/negacion', (req: Request, res: Response) => {
  res.render('negacion', { title: 'informacion' });
});

router.post('/contact/add', controllerContacts.add.bind(controllerContacts));

router.get('/admin/contactlist', controllerContacts.list.bind(controllerContacts));

router.get('/index', (req, res) => {
  res.render('index', { title: 'inicio' });
});

export default router;
