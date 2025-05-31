import { initializeDB } from '../database/db';
import { v4 as uuidv4 } from 'uuid';

export class ContactsModel {
    async addContact(contactData: {
        email: string;
        name: string;
        comment: string;
        ipAddress: string;
        country: string;
    
    }) {
        const db = await initializeDB();
        
        try {
            const result = await db.run(
                `INSERT INTO contacts (email, name, comment, ip_address, country) 
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    contactData.email,
                    contactData.name,
                    contactData.comment,
                    contactData.ipAddress,
                    contactData.country
                ]
            );
            
            return result.lastID;
        } finally {
            await db.close();
        }
    }

    async getAllContacts() {
        const db = await initializeDB();
        
        try {
            return await db.all('SELECT * FROM contacts ORDER BY created_at DESC');
        } finally {
            await db.close();
        }
    }
}