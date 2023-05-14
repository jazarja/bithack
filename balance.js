const fs = require('fs');
const csv = require('csv-parser');
const Hapi = require('@hapi/hapi');
const HashTable = require('megahash');

const addresses = new HashTable();
let addressesCounter = 0;
let queriesCounter = 0;

const initServer = async () => {
    const server = Hapi.server({
        port: 3000,
        host: 'localhost'
    });

    server.route({
        method: 'GET',
        path: '/',
        handler: (request, h) => {
            const queryParams = new URL(request.url.href, `http://${request.headers.host}`).searchParams;
            const queryValue = queryParams.get('query');

            if (queryValue && queryValue.trim() !== '') {
                queriesCounter++;
                if (queriesCounter % 1000 === 0) {
                    console.log(queriesCounter, 'queries served.');
                }
                const balance = addresses.get(queryValue);
                if (balance) {
                    return { found: true, address: queryValue, balance };
                } else {
                    return { found: false };
                }

            } else {
                return h.response('Invalid or missing query parameter').code(400);
            }
        }
    });

    try {
        await server.start();
        console.log(`Server running on ${server.info.uri}`);
    } catch (err) {
        console.error('Error starting server:', err);
    }
};

const loadAddresses = () => {
    fs.createReadStream('addresses.csv')
        .pipe(csv())
        .on('data', (data) => {
            addresses.set(data["address"], data["value_satoshi"]);
            addressesCounter++;
            if (addressesCounter % 100000 === 0) {
                console.log(addressesCounter, 'addresses loaded.');
            }
        })
        .on('end', () => {
            console.log('Addresses loaded successfully!');
            initServer();
        });
};

loadAddresses();
