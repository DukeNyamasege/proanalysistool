import { generateDerivApiInstance, V2GetActiveToken } from './appId';

class ChartAPI {
    api;
    is_authorized = false;
    is_replacing_connection = false;
    socket_open_handler = this.onsocketopen.bind(this);
    socket_close_handler = this.onsocketclose.bind(this);

    onsocketopen() {
        // When socket opens, authorize the connection
        this.authorizeChartConnection();
    }

    onsocketclose() {
        if (this.is_replacing_connection) return;
        this.is_authorized = false;
        this.reconnectIfNotConnected();
    }

    init = async (force_create_connection = false) => {
        if (!this.api || force_create_connection) {
            if (this.api?.connection) {
                this.is_replacing_connection = true;
                this.api.connection.removeEventListener('open', this.socket_open_handler);
                this.api.connection.removeEventListener('close', this.socket_close_handler);
                this.api.disconnect();
                this.is_replacing_connection = false;
            }
            this.api = await generateDerivApiInstance();
            this.api?.connection.addEventListener('open', this.socket_open_handler);
            this.api?.connection.addEventListener('close', this.socket_close_handler);
        }
        this.getTime();
    };

    authorizeChartConnection = async () => {
        // If already authorized, don't authorize again
        if (this.is_authorized) return;

        const token = V2GetActiveToken();
        if (!token || !this.api) return;

        try {
            const { error } = await this.api.authorize(token);

            if (error) {
                console.error('Chart API authorization error:', error);
                this.is_authorized = false;
            } else {
                console.log('Chart WebSocket connection authorized successfully');
                this.is_authorized = true;
            }
        } catch (e) {
            console.error('Chart API authorization failed:', e);
            this.is_authorized = false;
        }
    };

    getTime() {
        if (!this.time_interval) {
            this.time_interval = setInterval(() => {
                this.api.send({ time: 1 });
            }, 30000);
        }
    }

    reconnectIfNotConnected = () => {
        // eslint-disable-next-line no-console
        console.log('chart connection state: ', this.api?.connection?.readyState);
        if (this.api?.connection?.readyState && this.api?.connection?.readyState > 1) {
            // eslint-disable-next-line no-console
            console.log('Info: Chart connection to the server was closed, trying to reconnect.');
            this.init(true);
        }
    };
}

const chart_api = new ChartAPI();

export default chart_api;
