const MATCHESTOOL_PROVIDER_HOST = 'matchestool.pro';
const MATCHESTOOL_PROVIDER_URL = `wss://${MATCHESTOOL_PROVIDER_HOST}/market-data`;
const MATCHESTOOL_BALANCES_STORAGE_KEY = 'matchestool.virtual_balances';
const DERIV_PUBLIC_APP_ID = 36300;
const DERIV_PUBLIC_PROVIDER_HOST = 'ws.derivws.com';

const MARKET_SYMBOLS = [
    { symbol: 'R_10', display_name: 'Volatility 10 Index', base: 1100.12 },
    { symbol: 'R_25', display_name: 'Volatility 25 Index', base: 2500.25 },
    { symbol: 'R_50', display_name: 'Volatility 50 Index', base: 5000.5 },
    { symbol: 'R_75', display_name: 'Volatility 75 Index', base: 7500.75 },
    { symbol: 'R_100', display_name: 'Volatility 100 Index', base: 10000.1 },
    { symbol: '1HZ10V', display_name: 'Volatility 10 (1s) Index', base: 1010.1 },
    { symbol: '1HZ25V', display_name: 'Volatility 25 (1s) Index', base: 2525.25 },
    { symbol: '1HZ50V', display_name: 'Volatility 50 (1s) Index', base: 5050.5 },
    { symbol: '1HZ75V', display_name: 'Volatility 75 (1s) Index', base: 7575.75 },
    { symbol: '1HZ100V', display_name: 'Volatility 100 (1s) Index', base: 10100.1 },
];

const SYMBOL_MAP = MARKET_SYMBOLS.reduce((map, item) => {
    map[item.symbol] = item;
    return map;
}, {});

const MATCHESTOOL_ACCOUNTS = [
    {
        account_category: 'trading',
        account_type: 'demo',
        balance: 9500,
        broker: 'matchestool',
        created_at: 1720000000,
        currency: 'USD',
        currency_type: 'fiat',
        email: 'demo@matchestool.pro',
        is_disabled: 0,
        is_virtual: 1,
        landing_company_name: 'svg',
        linked_to: [],
        loginid: 'DOT00000487',
        token: 'matchestool-demo-dot-00000487-token',
    },
    {
        account_category: 'trading',
        account_type: 'standard',
        balance: 500,
        broker: 'matchestool',
        created_at: 1720000000,
        currency: 'USD',
        currency_type: 'fiat',
        email: 'real@matchestool.pro',
        is_disabled: 0,
        is_virtual: 0,
        landing_company_name: 'svg',
        linked_to: [],
        loginid: 'ROT00000457',
        token: 'matchestool-real-rot-00000457-token',
    },
];

class MatchestoolConnection {
    readyState = WebSocket.CONNECTING;
    listeners = {
        close: new Set(),
        open: new Set(),
    };

    constructor() {
        window.setTimeout(() => {
            this.readyState = WebSocket.OPEN;
            this.emit('open');
        }, 0);
    }

    addEventListener(event, callback) {
        this.listeners[event]?.add(callback);
    }

    removeEventListener(event, callback) {
        this.listeners[event]?.delete(callback);
    }

    close({ emit_close = true } = {}) {
        this.readyState = WebSocket.CLOSED;
        if (emit_close) this.emit('close');
    }

    emit(event) {
        this.listeners[event]?.forEach(callback => callback());
    }
}

export default class MatchestoolMarketDataAPI {
    constructor({ brand, language }) {
        this.brand = brand;
        this.language = language;
        this.provider_url = MATCHESTOOL_PROVIDER_URL;
        this.connection = new MatchestoolConnection();
        this.listeners = new Set();
        this.subscriptions = new Map();
        this.pending_public_requests = new Map();
        this.public_request_counter = 1;
        this.public_socket = null;
        this.public_socket_promise = null;
        this.subscription_counter = 1;
        this.contract_counter = 1000000;
        this.symbol_state = new Map();
        this.active_account = MATCHESTOOL_ACCOUNTS[0];
        this.latest_public_ticks = new Map();
        this.proposals = new Map();
        this.virtual_contracts = new Map();
        this.virtual_balances = this.loadVirtualBalances();
    }

    disconnect = () => {
        this.forgetAll();
        this.closeDerivPublicSocket();
        this.connection.close({ emit_close: false });
    };

    onMessage = () => ({
        subscribe: callback => {
            this.listeners.add(callback);
            return {
                unsubscribe: () => this.listeners.delete(callback),
            };
        },
    });

    emit(data) {
        this.listeners.forEach(callback => callback({ data }));
    }

    async send(request = {}) {
        if (request.ping) return this.withMeta(request, { msg_type: 'ping', ping: 'pong' });
        if (request.time) return this.publicRequest(request, () => this.withMeta(request, { msg_type: 'time', time: Math.floor(Date.now() / 1000) }));
        if (request.active_symbols) return this.activeSymbols(request);
        if (request.trading_times) return this.tradingTimes(request);
        if (request.contracts_for) return this.contractsFor(request);
        if (request.ticks_history) return this.ticksHistory(request);
        if (request.ticks) return this.ticks(request);
        if (request.forget) return this.forget(request.forget);
        if (request.forget_all) return this.forgetAll(request.forget_all);
        if (request.proposal) return this.proposal(request);
        if (request.buy) return this.buy(request);
        if (request.sell) return this.sell(request);
        if (request.proposal_open_contract) return this.proposalOpenContract(request);
        if (request.balance) return this.balance(request);
        if (request.topup_virtual) return this.topupVirtual(request);
        if (request.transaction) return this.transaction(request);
        if (request.landing_company_details) return this.landingCompanyDetails(request);
        if (request.tnc_approval) return this.withMeta(request, { msg_type: 'tnc_approval', tnc_approval: 1 });

        return this.withMeta(request, { msg_type: 'unknown', echo_req: request });
    }

    async authorize(token) {
        this.virtual_balances = this.loadVirtualBalances();
        this.active_account = this.getAccountByToken(token);

        return {
            authorize: {
                account_list: MATCHESTOOL_ACCOUNTS.map(account => this.toAccountListItem(account)),
                balance: this.getActiveVirtualBalance(),
                country: 'ke',
                currency: this.active_account.currency,
                email: this.active_account.email,
                fullname: 'Matchestool Client',
                is_virtual: this.active_account.is_virtual,
                landing_company_fullname: 'Matchestool Markets',
                landing_company_name: 'svg',
                linked_to: [],
                local_currencies: {},
                loginid: this.active_account.loginid,
                preferred_language: 'EN',
                scopes: ['read', 'trade'],
                token,
                upgradeable_landing_companies: [],
                user_id: 1001,
            },
            error: null,
        };
    }

    async websiteStatus() {
        return {
            msg_type: 'website_status',
            website_status: {
                clients_country: 'ke',
                site_status: 'up',
                supported_languages: ['EN'],
            },
        };
    }

    async time() {
        return this.send({ time: 1 });
    }

    async getSettings() {
        return {
            msg_type: 'get_settings',
            get_settings: {
                country_code: 'ke',
                email: this.active_account.email,
                first_name: 'Matchestool',
                last_name: 'Client',
                preferred_language: 'EN',
                residence: 'ke',
            },
        };
    }

    async getAccountStatus() {
        return {
            msg_type: 'get_account_status',
            get_account_status: {
                currency_config: {},
                p2p_status: 'none',
                prompt_client_to_authenticate: 0,
                status: [],
            },
        };
    }

    async getSelfExclusion() {
        return { msg_type: 'get_self_exclusion', get_self_exclusion: {} };
    }

    async landingCompany() {
        return {
            msg_type: 'landing_company',
            landing_company: {
                financial_company: { shortcode: 'svg' },
                gaming_company: { shortcode: 'svg' },
            },
        };
    }

    async forget(id) {
        const subscription = this.subscriptions.get(id);
        if (subscription?.source === 'deriv') {
            this.subscriptions.delete(id);
            return this.publicRequest({ forget: id }, () => ({ forget: id, msg_type: 'forget' }));
        }
        if (subscription?.timer) window.clearInterval(subscription.timer);
        this.subscriptions.delete(id);
        return { forget: id, msg_type: 'forget' };
    }

    async forgetAll(type) {
        const deriv_forget_tasks = [];

        Array.from(this.subscriptions.entries()).forEach(([id, subscription]) => {
            if (!type || subscription.type === type || subscription.style === type) {
                if (subscription.source === 'deriv') {
                    deriv_forget_tasks.push(this.publicRequest({ forget: id }, () => ({ forget: id, msg_type: 'forget' })));
                } else if (subscription.timer) {
                    window.clearInterval(subscription.timer);
                }
                this.subscriptions.delete(id);
            }
        });

        if (type) {
            deriv_forget_tasks.push(
                this.publicRequest({ forget_all: type }, () => ({ forget_all: type, msg_type: 'forget_all' }))
            );
        }
        await Promise.allSettled(deriv_forget_tasks);

        return { forget_all: type || 'all', msg_type: 'forget_all' };
    }

    activeSymbols(request) {
        return this.publicRequest(request, () => {
            const active_symbols = MARKET_SYMBOLS.map(item => ({
                allow_forward_starting: 0,
                display_name: item.display_name,
                exchange_is_open: 1,
                is_trading_suspended: 0,
                market: 'synthetic_index',
                market_display_name: 'Synthetic Indices',
                pip: 0.01,
                submarket: 'random_index',
                submarket_display_name: 'Continuous Indices',
                symbol: item.symbol,
            }));

            return this.withMeta(request, { active_symbols, msg_type: 'active_symbols' });
        });
    }

    tradingTimes(request) {
        return this.publicRequest(request, () => this.withMeta(request, {
            msg_type: 'trading_times',
            trading_times: {
                markets: [
                    {
                        name: 'synthetic_index',
                        submarkets: [
                            {
                                name: 'random_index',
                                symbols: MARKET_SYMBOLS.map(item => ({
                                    name: item.display_name,
                                    symbol: item.symbol,
                                    times: {
                                        close: ['23:59:59'],
                                        open: ['00:00:00'],
                                    },
                                })),
                            },
                        ],
                    },
                ],
            },
        }));
    }

    contractsFor(request) {
        const symbol = this.normaliseSymbol(request.contracts_for);
        const fallback_response = () => this.buildContractsForResponse(request, symbol, []);

        return this.sendDerivPublicRequest({ ...request, contracts_for: symbol })
            .then(response => {
                this.observeDerivResponse(response, request);
                if (response?.error) return fallback_response();
                return this.buildContractsForResponse(request, symbol, response.contracts_for?.available || []);
            })
            .catch(error => {
                console.warn('[Matchestool] Deriv contracts_for unavailable, using expanded virtual list:', error);
                return fallback_response();
            });
    }

    ticksHistory(request) {
        const symbol = this.normaliseSymbol(request.ticks_history);
        const style = request.style || (request.granularity ? 'candles' : 'ticks');
        const count = Math.min(Number(request.count) || 1000, 1000);
        return this.publicRequest({ ...request, ticks_history: symbol }, () => {
            const response =
                style === 'candles'
                    ? {
                          candles: this.generateCandles(symbol, count, Number(request.granularity) || 60),
                          msg_type: 'candles',
                      }
                    : {
                          history: this.generateTickHistory(symbol, count),
                          msg_type: 'history',
                      };

            if (request.subscribe) {
                const subscription = this.subscribeToSymbol(symbol, style, Number(request.granularity) || 60);
                response.subscription = { id: subscription.id };
            }

            return this.withMeta(request, response);
        });
    }

    ticks(request) {
        const symbols = Array.isArray(request.ticks) ? request.ticks : [request.ticks];
        const normalized_request = { ...request, ticks: Array.isArray(request.ticks) ? symbols.map(symbol => this.normaliseSymbol(symbol)) : this.normaliseSymbol(request.ticks) };

        return this.publicRequest(normalized_request, () => {
            const subscriptions = symbols.map(symbol => this.subscribeToSymbol(this.normaliseSymbol(symbol), 'ticks'));
            return this.withMeta(request, {
                msg_type: 'tick',
                subscription: { id: subscriptions[0]?.id },
                tick: {
                    id: subscriptions[0]?.id,
                    quote: this.getQuote(this.normaliseSymbol(symbols[0])),
                    symbol: this.normaliseSymbol(symbols[0]),
                },
            });
        });
    }

    balance(request) {
        const active_account = this.active_account || MATCHESTOOL_ACCOUNTS[0];
        const accounts = MATCHESTOOL_ACCOUNTS.reduce((map, account) => {
            map[account.loginid] = {
                balance: this.virtual_balances[account.loginid] ?? account.balance,
                currency: account.currency,
                loginid: account.loginid,
            };
            return map;
        }, {});

        const data = {
            balance: {
                accounts,
                balance: this.getActiveVirtualBalance(),
                currency: active_account.currency,
                loginid: active_account.loginid,
            },
            msg_type: 'balance',
            subscription: request.subscribe ? { id: this.createPassiveSubscription('balance').id } : undefined,
        };
        if (request.subscribe) this.emit(data);
        return this.withMeta(request, data);
    }

    topupVirtual(request) {
        const loginid = this.active_account?.loginid || MATCHESTOOL_ACCOUNTS[0].loginid;
        if (!this.active_account?.is_virtual) {
            return this.withMeta(request, {
                error: {
                    code: 'OnlyVirtualAccount',
                    message: 'Only the demo account balance can be reset.',
                },
                msg_type: 'topup_virtual',
            });
        }

        this.virtual_balances[loginid] = this.active_account.balance;
        this.persistVirtualBalances();
        this.emitBalance();

        return this.withMeta(request, {
            msg_type: 'topup_virtual',
            topup_virtual: 1,
        });
    }

    transaction(request) {
        return this.withMeta(request, {
            msg_type: 'transaction',
            subscription: request.subscribe ? { id: this.createPassiveSubscription('transaction').id } : undefined,
        });
    }

    proposalOpenContract(request) {
        const contract_id = request.contract_id || this.contract_counter;
        const existing_contract = this.virtual_contracts.get(contract_id);
        const subscription = request.subscribe ? this.createPassiveSubscription('proposal_open_contract') : undefined;
        const contract =
            existing_contract ||
            this.createContract(contract_id, {
                status: request.subscribe ? 'open' : 'won',
            });
        const data = {
            msg_type: 'proposal_open_contract',
            proposal_open_contract: contract,
            subscription: subscription ? { id: subscription.id } : undefined,
        };
        if (request.subscribe) this.emit(data);
        return this.withMeta(request, data);
    }

    proposal(request) {
        const normalized_request = this.prepareProposalRequest(request);
        return this.publicRequest(normalized_request, () => {
            const proposal = this.createFallbackProposal(normalized_request);
            this.proposals.set(proposal.id, { proposal, request: normalized_request });
            return this.withMeta(request, {
                msg_type: 'proposal',
                proposal,
                subscription: request.subscribe ? { id: this.createPassiveSubscription('proposal').id } : undefined,
            });
        });
    }

    prepareProposalRequest(request = {}) {
        const amount = Number(request.amount || request.price || 1);
        const contract_type = request.contract_type || request.parameters?.contract_type || 'CALL';
        const duration = Number(request.duration || request.parameters?.duration || 1);
        const symbol = this.normaliseSymbol(request.symbol || request.parameters?.symbol);
        const normalized = {
            ...request,
            amount: Number.isFinite(amount) && amount > 0 ? amount : 1,
            basis: request.basis || request.parameters?.basis || 'stake',
            contract_type,
            currency: request.currency || request.parameters?.currency || 'USD',
            duration: Number.isFinite(duration) && duration > 0 ? duration : 1,
            duration_unit: request.duration_unit || request.parameters?.duration_unit || 't',
            proposal: 1,
            symbol,
        };
        const barrier = request.barrier ?? request.parameters?.barrier ?? this.getDefaultBarrier(contract_type);
        if (typeof barrier !== 'undefined') normalized.barrier = barrier;
        return normalized;
    }

    createFallbackProposal(request = {}) {
        const id = `proposal-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const { buy_price, payout } = this.calculateVirtualProposalTerms(request);
        const symbol = this.normaliseSymbol(request.symbol);
        const spot = this.getQuote(symbol);
        return {
            ask_price: buy_price,
            barrier: request.barrier,
            contract_type: request.contract_type,
            date_start: Math.floor(Date.now() / 1000),
            display_value: String(buy_price),
            id,
            longcode: `Matchestool virtual execution priced from Deriv public ${request.contract_type || 'market'} proposal format on ${symbol}`,
            payout,
            spot,
            spot_time: Math.floor(Date.now() / 1000),
            symbol,
        };
    }

    async resolveProposalForVirtualBuy(request = {}) {
        const stored_proposal = this.proposals.get(request.buy);
        if (stored_proposal?.proposal) {
            return {
                proposal: stored_proposal.proposal,
                proposal_request: this.prepareProposalRequest(stored_proposal.request || request.parameters || request),
            };
        }

        const proposal_request = this.prepareProposalRequest(request.parameters || request);
        const response = await this.publicRequest(proposal_request, () => {
            const proposal = this.createFallbackProposal(proposal_request);
            this.proposals.set(proposal.id, { proposal, request: proposal_request });
            return {
                msg_type: 'proposal',
                proposal,
            };
        });
        const proposal = response?.proposal || this.createFallbackProposal(proposal_request);
        this.proposals.set(proposal.id, { proposal, request: proposal_request });
        return { proposal, proposal_request };
    }

    getProposalExecutionTerms(proposal = {}, proposal_request = {}, buy_request = {}) {
        const proposal_terms = this.calculateVirtualProposalTerms(proposal_request);
        const buy_price = this.roundMoney(
            Number(proposal.ask_price || buy_request.price || proposal_terms.buy_price || proposal_request.amount || 1)
        );
        const payout = this.roundMoney(Number(proposal.payout || proposal_terms.payout || buy_price));
        return {
            buy_price: Number.isFinite(buy_price) && buy_price > 0 ? buy_price : 1,
            payout: Number.isFinite(payout) && payout > 0 ? payout : this.roundMoney(buy_price * 1.01),
        };
    }

    calculateVirtualProposalTerms(request = {}) {
        const amount = Number(request.amount || 1);
        const multiplier = this.getVirtualPayoutMultiplier(request.contract_type, request);
        const basis = request.basis || 'stake';
        if (basis === 'payout') {
            return {
                buy_price: this.roundMoney(amount / multiplier),
                payout: this.roundMoney(amount),
            };
        }
        return {
            buy_price: this.roundMoney(amount),
            payout: this.roundMoney(amount * multiplier),
        };
    }

    getVirtualPayoutMultiplier(contract_type = 'CALL', request = {}) {
        const type = String(contract_type || '').toUpperCase();
        const barrier = Number(String(request.barrier ?? '').replace(/[^\d.-]/g, ''));
        const digit = Number.isFinite(barrier) ? Math.min(Math.max(Math.floor(barrier), 0), 9) : 5;

        if (type === 'DIGITMATCH') return 8.33;
        if (type === 'DIGITDIFF') return 1.09;
        if (type === 'DIGITEVEN' || type === 'DIGITODD') return 1.9;
        if (type === 'DIGITOVER') return this.roundMoney((10 / Math.max(9 - digit, 1)) * 0.95);
        if (type === 'DIGITUNDER') return this.roundMoney((10 / Math.max(digit, 1)) * 0.95);
        if (type === 'CALL' || type === 'PUT') return 1.92;
        if (type === 'CALLE' || type === 'PUTE') return 1.86;
        if (type === 'ONETOUCH') return 1.8;
        if (type === 'NOTOUCH') return 1.25;
        if (type === 'EXPIRYRANGE' || type === 'EXPIRYMISS' || type === 'RANGE' || type === 'UPORDOWN') return 1.75;
        if (type === 'ASIANU' || type === 'ASIAND') return 1.87;
        if (type === 'TICKHIGH' || type === 'TICKLOW') return 1.9;
        if (type === 'RESETCALL' || type === 'RESETPUT') return 1.82;
        if (type === 'RUNHIGH' || type === 'RUNLOW') return 1.65;
        if (type === 'LBFLOATCALL' || type === 'LBFLOATPUT' || type === 'LBHIGHLOW') return 1.5;
        if (type === 'CALLSPREAD' || type === 'PUTSPREAD') return 1.35;
        if (type === 'MULTUP' || type === 'MULTDOWN') return 1.2;
        if (type === 'ACCU') return 1.03;
        return 1.9;
    }

    getDefaultBarrier(contract_type = '') {
        const type = String(contract_type || '').toUpperCase();
        if (type === 'DIGITMATCH' || type === 'DIGITDIFF') return 0;
        if (type === 'DIGITOVER' || type === 'DIGITUNDER') return 5;
        if (type === 'ONETOUCH' || type === 'NOTOUCH') return '+0.1';
        if (type === 'EXPIRYRANGE' || type === 'EXPIRYMISS' || type === 'RANGE' || type === 'UPORDOWN') return '+1.0';
        if (type === 'CALLSPREAD' || type === 'PUTSPREAD') return '+0.1';
        return undefined;
    }

    roundMoney(value) {
        return Number(Number(value || 0).toFixed(2));
    }

    async buy(request) {
        const contract_id = ++this.contract_counter;
        const { proposal, proposal_request } = await this.resolveProposalForVirtualBuy(request);
        const terms = this.getProposalExecutionTerms(proposal, proposal_request, request);
        const buy_price = terms.buy_price;
        const payout = terms.payout;
        const symbol = this.normaliseSymbol(proposal?.symbol || proposal_request.symbol);
        const entry_tick = Number(proposal?.spot || this.getQuote(symbol));
        this.adjustVirtualBalance(-buy_price);
        const contract = this.createContract(contract_id, {
            barrier: proposal?.barrier ?? proposal_request.barrier,
            buy_price,
            contract_type: proposal?.contract_type || proposal_request.contract_type,
            entry_tick,
            exit_tick: this.isOneTickContract(proposal_request) ? entry_tick : undefined,
            longcode: proposal?.longcode,
            payout,
            symbol,
            status: 'open',
        });
        this.virtual_contracts.set(contract_id, contract);

        window.setTimeout(async () => {
            const settled_contract = await this.settleVirtualContract(contract, proposal_request, payout);
            this.virtual_contracts.set(contract_id, settled_contract);
            this.emit({
                msg_type: 'proposal_open_contract',
                proposal_open_contract: settled_contract,
            });
            this.emitBalance();
        }, this.getVirtualSettlementDelay(proposal_request));

        return this.withMeta(request, {
            buy: {
                balance_after: this.getActiveVirtualBalance(),
                buy_price,
                contract_id,
                longcode: contract.longcode,
                purchase_time: contract.entry_tick_time,
                shortcode: `MATCH_${contract.contract_type}_${contract.symbol}`,
                start_time: contract.entry_tick_time,
                transaction_id: contract.transaction_ids.buy,
            },
            msg_type: 'buy',
        });
    }

    sell(request) {
        return this.withMeta(request, {
            msg_type: 'sell',
            sell: {
                balance_after: this.getActiveVirtualBalance(),
                contract_id: request.sell,
                sold_for: 0,
                transaction_id: Math.floor(Date.now() / 1000),
            },
        });
    }

    landingCompanyDetails(request) {
        return this.withMeta(request, {
            landing_company_details: {
                currency_config: {
                    synthetic_index: {
                        USD: {
                            max_stake: 10000,
                            min_stake: 0.35,
                        },
                    },
                },
            },
            msg_type: 'landing_company_details',
        });
    }

    buildContractsForResponse(request, symbol, deriv_available = []) {
        const merged_available = this.mergeContracts(deriv_available, this.getExpandedAvailableContracts(symbol));

        return this.withDerivMeta(request, {
            contracts_for: {
                available: merged_available,
                close: '23:59:59',
                feed_license: 'Deriv public data + Matchestool virtual execution',
                hit_count: merged_available.length,
                open: '00:00:00',
                spot: this.getQuote(symbol),
            },
            msg_type: 'contracts_for',
        });
    }

    mergeContracts(primary = [], additions = []) {
        const by_key = new Map();
        [...primary, ...additions].forEach(contract => {
            const key = [
                contract.contract_type,
                contract.contract_category,
                contract.barrier_category,
                contract.expiry_type,
                contract.min_contract_duration,
                contract.max_contract_duration,
            ].join('|');
            by_key.set(key, contract);
        });
        return Array.from(by_key.values());
    }

    getExpandedAvailableContracts(symbol) {
        const base_contract = {
            cancellation_range: ['5m', '10m', '15m', '30m', '60m'],
            close: '23:59:59',
            exchange_name: 'deriv-public-virtual',
            market: 'synthetic_index',
            max_contract_duration: '365d',
            min_contract_duration: '1t',
            open: '00:00:00',
            start_type: 'spot',
            submarket: 'random_index',
            symbol,
            trading_period: {
                max: '365d',
                min: '1t',
            },
        };

        const build = overrides => ({
            ...base_contract,
            ...overrides,
        });

        return [
            build({
                barrier_category: 'euro_atm',
                contract_category: 'callput',
                contract_type: 'CALL',
                expiry_type: 'tick',
                sentiment: 'up',
            }),
            build({
                barrier_category: 'euro_atm',
                contract_category: 'callput',
                contract_type: 'PUT',
                expiry_type: 'tick',
                sentiment: 'down',
            }),
            build({
                barrier_category: 'euro_atm',
                contract_category: 'callputequal',
                contract_type: 'CALLE',
                expiry_type: 'tick',
                sentiment: 'up',
            }),
            build({
                barrier_category: 'euro_atm',
                contract_category: 'callputequal',
                contract_type: 'PUTE',
                expiry_type: 'tick',
                sentiment: 'down',
            }),
            build({
                barrier_category: 'euro_non_atm',
                contract_category: 'higherlower',
                contract_type: 'CALL',
                expiry_type: 'tick',
                sentiment: 'up',
            }),
            build({
                barrier_category: 'euro_non_atm',
                contract_category: 'higherlower',
                contract_type: 'PUT',
                expiry_type: 'tick',
                sentiment: 'down',
            }),
            build({
                barrier_category: 'american',
                contract_category: 'touchnotouch',
                contract_type: 'ONETOUCH',
                expiry_type: 'tick',
                sentiment: 'up',
            }),
            build({
                barrier_category: 'american',
                contract_category: 'touchnotouch',
                contract_type: 'NOTOUCH',
                expiry_type: 'tick',
                sentiment: 'down',
            }),
            build({
                barrier_category: 'euro_non_atm',
                contract_category: 'endsinout',
                contract_type: 'EXPIRYRANGE',
                expiry_type: 'tick',
                sentiment: 'up',
            }),
            build({
                barrier_category: 'euro_non_atm',
                contract_category: 'endsinout',
                contract_type: 'EXPIRYMISS',
                expiry_type: 'tick',
                sentiment: 'down',
            }),
            build({
                barrier_category: 'american',
                contract_category: 'staysinout',
                contract_type: 'RANGE',
                expiry_type: 'tick',
                sentiment: 'up',
            }),
            build({
                barrier_category: 'american',
                contract_category: 'staysinout',
                contract_type: 'UPORDOWN',
                expiry_type: 'tick',
                sentiment: 'down',
            }),
            build({
                barrier_category: 'asian',
                contract_category: 'asians',
                contract_type: 'ASIANU',
                expiry_type: 'tick',
                sentiment: 'up',
            }),
            build({
                barrier_category: 'asian',
                contract_category: 'asians',
                contract_type: 'ASIAND',
                expiry_type: 'tick',
                sentiment: 'down',
            }),
            ...['DIGITMATCH', 'DIGITDIFF', 'DIGITOVER', 'DIGITUNDER', 'DIGITEVEN', 'DIGITODD'].map(contract_type =>
                build({
                    barrier_category: 'non_financial',
                    contract_category: ['DIGITEVEN', 'DIGITODD'].includes(contract_type)
                        ? 'evenodd'
                        : ['DIGITOVER', 'DIGITUNDER'].includes(contract_type)
                          ? 'overunder'
                          : 'matchesdiffers',
                    contract_type,
                    expiry_type: 'tick',
                    last_digit_range: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
                    sentiment: ['DIGITDIFF', 'DIGITUNDER', 'DIGITODD'].includes(contract_type) ? 'down' : 'up',
                })
            ),
            build({
                barrier_category: 'american',
                contract_category: 'highlowticks',
                contract_type: 'TICKHIGH',
                expiry_type: 'tick',
                last_digit_range: [1, 2, 3, 4, 5],
                sentiment: 'up',
            }),
            build({
                barrier_category: 'american',
                contract_category: 'highlowticks',
                contract_type: 'TICKLOW',
                expiry_type: 'tick',
                last_digit_range: [1, 2, 3, 4, 5],
                sentiment: 'down',
            }),
            build({
                barrier_category: 'reset',
                contract_category: 'reset',
                contract_type: 'RESETCALL',
                expiry_type: 'tick',
                sentiment: 'up',
            }),
            build({
                barrier_category: 'reset',
                contract_category: 'reset',
                contract_type: 'RESETPUT',
                expiry_type: 'tick',
                sentiment: 'down',
            }),
            build({
                barrier_category: 'american',
                contract_category: 'runs',
                contract_type: 'RUNHIGH',
                expiry_type: 'tick',
                sentiment: 'up',
            }),
            build({
                barrier_category: 'american',
                contract_category: 'runs',
                contract_type: 'RUNLOW',
                expiry_type: 'tick',
                sentiment: 'down',
            }),
            build({
                barrier_category: 'lookback',
                contract_category: 'lookback',
                contract_type: 'LBFLOATCALL',
                expiry_type: 'tick',
                sentiment: 'up',
            }),
            build({
                barrier_category: 'lookback',
                contract_category: 'lookback',
                contract_type: 'LBFLOATPUT',
                expiry_type: 'tick',
                sentiment: 'down',
            }),
            build({
                barrier_category: 'lookback',
                contract_category: 'lookback',
                contract_type: 'LBHIGHLOW',
                expiry_type: 'tick',
                sentiment: 'up',
            }),
            build({
                barrier_category: 'euro_non_atm',
                contract_category: 'callputspread',
                contract_type: 'CALLSPREAD',
                expiry_type: 'tick',
                sentiment: 'up',
            }),
            build({
                barrier_category: 'euro_non_atm',
                contract_category: 'callputspread',
                contract_type: 'PUTSPREAD',
                expiry_type: 'tick',
                sentiment: 'down',
            }),
            build({
                barrier_category: 'american',
                contract_category: 'multiplier',
                contract_type: 'MULTUP',
                expiry_type: 'intraday',
                max_contract_duration: '1d',
                min_contract_duration: '1m',
                multiplier_range: [20, 40, 60, 100, 200],
                sentiment: 'up',
            }),
            build({
                barrier_category: 'american',
                contract_category: 'multiplier',
                contract_type: 'MULTDOWN',
                expiry_type: 'intraday',
                max_contract_duration: '1d',
                min_contract_duration: '1m',
                multiplier_range: [20, 40, 60, 100, 200],
                sentiment: 'down',
            }),
            build({
                barrier_category: 'accumulator',
                contract_category: 'accumulator',
                contract_type: 'ACCU',
                expiry_type: 'tick',
                growth_rate_range: [0.01, 0.02, 0.03, 0.04, 0.05],
                sentiment: 'up',
            }),
        ];
    }

    createPassiveSubscription(type) {
        const id = this.nextSubscriptionId(type);
        this.subscriptions.set(id, { id, style: type, type });
        return { id };
    }

    async publicRequest(request, fallback) {
        try {
            const response = await this.sendDerivPublicRequest(request);
            this.observeDerivResponse(response, request);

            if (response?.error) {
                console.warn('[Matchestool] Deriv public API returned an error, using virtual fallback:', response.error);
                return fallback();
            }

            return this.withDerivMeta(request, response);
        } catch (error) {
            console.warn('[Matchestool] Deriv public API unavailable, using virtual fallback:', error);
            return fallback();
        }
    }

    sendDerivPublicRequest(request) {
        return new Promise(async (resolve, reject) => {
            const socket = await this.ensureDerivPublicSocket().catch(reject);
            if (!socket || socket.readyState !== WebSocket.OPEN) return;

            const req_id = this.public_request_counter++;
            const timeout = window.setTimeout(() => {
                this.pending_public_requests.delete(req_id);
                reject(new Error(`Deriv public API timeout for ${Object.keys(request).join(',')}`));
            }, 15000);

            this.pending_public_requests.set(req_id, {
                reject,
                request,
                resolve,
                timeout,
            });

            socket.send(
                JSON.stringify({
                    ...request,
                    req_id,
                })
            );
        });
    }

    ensureDerivPublicSocket() {
        if (this.public_socket?.readyState === WebSocket.OPEN) return Promise.resolve(this.public_socket);
        if (this.public_socket?.readyState === WebSocket.CONNECTING && this.public_socket_promise) {
            return this.public_socket_promise;
        }

        const app_id = window.localStorage.getItem('config.app_id') || DERIV_PUBLIC_APP_ID;
        const language = String(this.language || 'EN').toUpperCase();
        const endpoint = `wss://${DERIV_PUBLIC_PROVIDER_HOST}/websockets/v3?app_id=${app_id}&l=${language}`;

        this.public_socket = new WebSocket(endpoint);
        this.public_socket_promise = new Promise((resolve, reject) => {
            this.public_socket.addEventListener('open', () => {
                this.public_socket_promise = null;
                resolve(this.public_socket);
            });

            this.public_socket.addEventListener('error', event => {
                this.public_socket_promise = null;
                reject(event);
            });
        });

        this.public_socket.addEventListener('message', event => {
            this.handleDerivPublicMessage(event);
        });

        this.public_socket.addEventListener('close', () => {
            this.public_socket = null;
            this.public_socket_promise = null;
            this.rejectPendingPublicRequests(new Error('Deriv public websocket closed'));
        });

        return this.public_socket_promise;
    }

    handleDerivPublicMessage(event) {
        let response;
        try {
            response = JSON.parse(event.data);
        } catch (error) {
            console.warn('[Matchestool] Could not parse Deriv public message:', error);
            return;
        }

        this.observeDerivResponse(response, response.echo_req || {});

        if (response.req_id && this.pending_public_requests.has(response.req_id)) {
            const pending = this.pending_public_requests.get(response.req_id);
            window.clearTimeout(pending.timeout);
            this.pending_public_requests.delete(response.req_id);
            pending.resolve(response);
        }

        this.emit(this.withDerivMeta(response.echo_req || {}, response));
    }

    observeDerivResponse(response, request) {
        if (!response) return;

        if (response.subscription?.id) {
            const style = response.msg_type === 'ohlc' || response.candles ? 'candles' : response.msg_type || 'deriv';
            this.subscriptions.set(response.subscription.id, {
                id: response.subscription.id,
                source: 'deriv',
                style,
                type: style,
            });
        }

        if (response.tick?.symbol && typeof response.tick.quote !== 'undefined') {
            this.latest_public_ticks.set(response.tick.symbol, {
                epoch: response.tick.epoch,
                quote: Number(response.tick.quote),
                symbol: response.tick.symbol,
            });
        }

        if (response.history?.prices?.length && request?.ticks_history) {
            const symbol = this.normaliseSymbol(request.ticks_history);
            const price = Number(response.history.prices[response.history.prices.length - 1]);
            const epoch = Number(response.history.times?.[response.history.times.length - 1] || Date.now() / 1000);
            this.latest_public_ticks.set(symbol, { epoch, quote: price, symbol });
        }

        if (response.proposal?.id) {
            this.proposals.set(response.proposal.id, {
                proposal: {
                    ...response.proposal,
                    contract_type: request.contract_type,
                    symbol: this.normaliseSymbol(request.symbol),
                },
                request,
            });
        }
    }

    rejectPendingPublicRequests(error) {
        Array.from(this.pending_public_requests.values()).forEach(pending => {
            window.clearTimeout(pending.timeout);
            pending.reject(error);
        });
        this.pending_public_requests.clear();
    }

    closeDerivPublicSocket() {
        this.rejectPendingPublicRequests(new Error('Matchestool adapter disconnected'));
        if (this.public_socket?.readyState === WebSocket.OPEN || this.public_socket?.readyState === WebSocket.CONNECTING) {
            this.public_socket.close();
        }
        this.public_socket = null;
        this.public_socket_promise = null;
    }

    emitBalance() {
        this.emit(this.balance({ balance: 1 }));
    }

    getActiveVirtualBalance() {
        const loginid = this.active_account?.loginid || MATCHESTOOL_ACCOUNTS[0].loginid;
        return Number((this.virtual_balances[loginid] ?? this.active_account?.balance ?? 0).toFixed(2));
    }

    adjustVirtualBalance(amount) {
        const loginid = this.active_account?.loginid || MATCHESTOOL_ACCOUNTS[0].loginid;
        const current_balance = this.virtual_balances[loginid] ?? this.active_account?.balance ?? 0;
        this.virtual_balances[loginid] = Number((current_balance + amount).toFixed(2));
        this.persistVirtualBalances();
        return this.virtual_balances[loginid];
    }

    getDefaultVirtualBalances() {
        return MATCHESTOOL_ACCOUNTS.reduce((balances, account) => {
            balances[account.loginid] = account.balance;
            return balances;
        }, {});
    }

    loadVirtualBalances() {
        const defaults = this.getDefaultVirtualBalances();
        if (typeof window === 'undefined' || !window.localStorage) return defaults;

        try {
            const stored_balances = JSON.parse(window.localStorage.getItem(MATCHESTOOL_BALANCES_STORAGE_KEY) || '{}');
            return MATCHESTOOL_ACCOUNTS.reduce((balances, account) => {
                const stored_balance = Number(stored_balances?.[account.loginid]);
                balances[account.loginid] = Number.isFinite(stored_balance) ? Number(stored_balance.toFixed(2)) : account.balance;
                return balances;
            }, {});
        } catch (error) {
            console.warn('[Matchestool] Could not read persisted virtual balances, using defaults:', error);
            return defaults;
        }
    }

    persistVirtualBalances() {
        if (typeof window === 'undefined' || !window.localStorage) return;

        try {
            window.localStorage.setItem(MATCHESTOOL_BALANCES_STORAGE_KEY, JSON.stringify(this.virtual_balances));
        } catch (error) {
            console.warn('[Matchestool] Could not persist virtual balances:', error);
        }
    }

    isOneTickContract(proposal_request = {}) {
        const duration = Number(proposal_request.duration || 1);
        const duration_unit = String(proposal_request.duration_unit || 't').toLowerCase();
        return duration_unit === 't' && duration === 1;
    }

    async getLatestPublicTick(symbol) {
        const normalized_symbol = this.normaliseSymbol(symbol);
        if (this.latest_public_ticks.has(normalized_symbol)) {
            return this.latest_public_ticks.get(normalized_symbol);
        }

        const response = await this.publicRequest(
            {
                count: 1,
                end: 'latest',
                style: 'ticks',
                ticks_history: normalized_symbol,
            },
            () => {
                const quote = this.getQuote(normalized_symbol);
                return {
                    history: {
                        prices: [quote],
                        times: [Math.floor(Date.now() / 1000)],
                    },
                    msg_type: 'history',
                };
            }
        );
        const quote = Number(response.history?.prices?.[response.history.prices.length - 1] || this.getQuote(normalized_symbol));
        const epoch = Number(response.history?.times?.[response.history.times.length - 1] || Date.now() / 1000);
        return { epoch, quote, symbol: normalized_symbol };
    }

    async settleVirtualContract(contract, proposal_request = {}, payout) {
        const symbol = this.normaliseSymbol(contract.symbol || proposal_request.symbol);
        const is_one_tick_contract = this.isOneTickContract(proposal_request);
        const latest_tick = is_one_tick_contract
            ? { epoch: contract.entry_tick_time, quote: contract.entry_tick, symbol }
            : await this.getLatestPublicTick(symbol);
        const exit_tick = Number(is_one_tick_contract ? contract.entry_tick : latest_tick.quote);
        const contract_type = contract.contract_type || proposal_request.contract_type;
        const did_win = this.evaluateVirtualOutcome(contract_type, contract.entry_tick, exit_tick, proposal_request, contract);
        const sell_price = did_win ? Number(payout || contract.payout || contract.buy_price * 1.95) : 0;

        this.adjustVirtualBalance(sell_price);

        return {
            ...contract,
            bid_price: sell_price,
            exit_tick,
            exit_tick_display_value: String(exit_tick),
            exit_tick_time: latest_tick.epoch || Math.floor(Date.now() / 1000),
            is_completed: true,
            is_expired: 1,
            is_sold: 1,
            is_valid_to_sell: 0,
            profit: Number((sell_price - contract.buy_price).toFixed(2)),
            sell_price,
            status: did_win ? 'won' : 'lost',
            transaction_ids: {
                ...contract.transaction_ids,
                sell: contract.transaction_ids?.sell || contract.contract_id + 1,
            },
        };
    }

    getLastDigit(value) {
        const normalized = String(value).replace(/\D/g, '');
        return Number(normalized[normalized.length - 1] || 0);
    }

    evaluateVirtualOutcome(contract_type, entry_tick, exit_tick, proposal_request = {}, contract = {}) {
        const type = contract_type || 'CALL';
        const entry = Number(entry_tick);
        const exit = Number(exit_tick);
        const barrier = Number(String(proposal_request.barrier ?? contract.barrier ?? '').replace(/[^\d.-]/g, ''));
        const exit_digit = this.getLastDigit(exit);
        const entry_digit = this.getLastDigit(entry);

        if (type === 'DIGITMATCH') return exit_digit === barrier;
        if (type === 'DIGITDIFF') return exit_digit !== barrier;
        if (type === 'DIGITEVEN') return exit_digit % 2 === 0;
        if (type === 'DIGITODD') return exit_digit % 2 === 1;
        if (type === 'DIGITOVER') return exit_digit > barrier;
        if (type === 'DIGITUNDER') return exit_digit < barrier;
        if (type === 'TICKHIGH') return exit_digit > entry_digit;
        if (type === 'TICKLOW') return exit_digit < entry_digit;

        if (['CALL', 'CALLE', 'RESETCALL', 'MULTUP', 'RUNHIGH', 'ASIANU', 'CALLSPREAD', 'LBFLOATCALL', 'LBHIGHLOW', 'ACCU'].includes(type)) {
            return type === 'CALLE' ? exit >= entry : exit > entry;
        }
        if (['PUT', 'PUTE', 'RESETPUT', 'MULTDOWN', 'RUNLOW', 'ASIAND', 'PUTSPREAD', 'LBFLOATPUT'].includes(type)) {
            return type === 'PUTE' ? exit <= entry : exit < entry;
        }
        if (type === 'ONETOUCH') return Math.abs(exit - entry) >= Math.max(Math.abs(barrier || 1), 0.1);
        if (type === 'NOTOUCH') return Math.abs(exit - entry) < Math.max(Math.abs(barrier || 1), 0.1);
        if (type === 'EXPIRYRANGE' || type === 'RANGE') return Math.abs(exit - entry) <= Math.max(Math.abs(barrier || 2), 1);
        if (type === 'EXPIRYMISS' || type === 'UPORDOWN') return Math.abs(exit - entry) > Math.max(Math.abs(barrier || 2), 1);

        return Math.random() > 0.5;
    }

    getVirtualSettlementDelay(proposal_request = {}) {
        const duration = Number(proposal_request.duration || 1);
        const duration_unit = proposal_request.duration_unit || 't';

        if (duration_unit === 's') return Math.min(Math.max(duration * 1000, 1000), 30000);
        if (duration_unit === 'm') return Math.min(Math.max(duration * 60 * 1000, 1000), 30000);
        if (duration_unit === 'h' || duration_unit === 'd') return 30000;
        return Math.min(Math.max(duration * 1200, 1200), 10000);
    }

    subscribeToSymbol(symbol, style = 'ticks', granularity = 60) {
        const id = this.nextSubscriptionId(style);
        const timer = window.setInterval(() => {
            if (style === 'candles') {
                this.emit({
                    msg_type: 'ohlc',
                    ohlc: this.generateLiveCandle(symbol, granularity, id),
                });
            } else {
                this.emit({
                    msg_type: 'tick',
                    tick: {
                        epoch: Math.floor(Date.now() / 1000),
                        id,
                        quote: this.getQuote(symbol),
                        symbol,
                    },
                });
            }
        }, this.isOneSecondSymbol(symbol) ? 1000 : 2000);

        this.subscriptions.set(id, { granularity, id, style, symbol, timer, type: style });
        return { id };
    }

    nextSubscriptionId(prefix) {
        const id = `${prefix}-${this.subscription_counter}`;
        this.subscription_counter += 1;
        return id;
    }

    getAccountByToken(token) {
        return MATCHESTOOL_ACCOUNTS.find(account => account.token === token) || MATCHESTOOL_ACCOUNTS[0];
    }

    toAccountListItem(account) {
        const { balance, email, token, ...account_list_item } = account;
        return account_list_item;
    }

    normaliseSymbol(symbol) {
        if (SYMBOL_MAP[symbol]) return symbol;
        if (symbol) return symbol;
        return '1HZ100V';
    }

    isOneSecondSymbol(symbol) {
        return String(symbol || '').startsWith('1HZ');
    }

    getQuote(symbol) {
        const normalized_symbol = this.normaliseSymbol(symbol);
        const latest_public_tick = this.latest_public_ticks.get(normalized_symbol);
        if (latest_public_tick?.quote) return Number(latest_public_tick.quote);

        const item = SYMBOL_MAP[normalized_symbol] || {
            base: 1000,
            symbol: normalized_symbol,
        };
        const state = this.symbol_state.get(item.symbol) || {
            quote: item.base,
            trend: item.symbol.length % 2 === 0 ? 1 : -1,
        };
        const movement = (Math.random() - 0.48) * (this.isOneSecondSymbol(item.symbol) ? 1.4 : 0.7) + state.trend * 0.03;
        state.quote = Math.max(1, state.quote + movement);
        state.trend = Math.random() > 0.94 ? state.trend * -1 : state.trend;
        this.symbol_state.set(item.symbol, state);
        return Number(state.quote.toFixed(2));
    }

    generateTickHistory(symbol, count) {
        const times = [];
        const prices = [];
        const now = Math.floor(Date.now() / 1000);
        const normalized_symbol = this.normaliseSymbol(symbol);
        const item = SYMBOL_MAP[normalized_symbol] || {
            base: this.latest_public_ticks.get(normalized_symbol)?.quote || 1000,
            symbol: normalized_symbol,
        };
        let quote = item.base;

        for (let i = count - 1; i >= 0; i--) {
            quote += (Math.random() - 0.5) * 0.9;
            times.push(now - i);
            prices.push(Number(quote.toFixed(2)));
        }

        this.symbol_state.set(item.symbol, { quote, trend: 1 });
        return { prices, times };
    }

    generateCandles(symbol, count, granularity) {
        const now = Math.floor(Date.now() / 1000);
        const candles = [];
        const normalized_symbol = this.normaliseSymbol(symbol);
        const item = SYMBOL_MAP[normalized_symbol] || {
            base: this.latest_public_ticks.get(normalized_symbol)?.quote || 1000,
            symbol: normalized_symbol,
        };
        let close = item.base;

        for (let i = count - 1; i >= 0; i--) {
            const open = close;
            close = Math.max(1, open + (Math.random() - 0.5) * 2);
            candles.push({
                close: Number(close.toFixed(2)),
                epoch: now - i * granularity,
                high: Number(Math.max(open, close + Math.random()).toFixed(2)),
                low: Number(Math.min(open, close - Math.random()).toFixed(2)),
                open: Number(open.toFixed(2)),
                open_time: now - i * granularity,
            });
        }

        return candles;
    }

    generateLiveCandle(symbol, granularity, id) {
        const close = this.getQuote(symbol);
        const open = Number((close + (Math.random() - 0.5)).toFixed(2));
        return {
            close,
            epoch: Math.floor(Date.now() / 1000),
            granularity,
            high: Number(Math.max(open, close + Math.random()).toFixed(2)),
            id,
            low: Number(Math.min(open, close - Math.random()).toFixed(2)),
            open,
            open_time: Math.floor(Date.now() / 1000),
            symbol,
        };
    }

    createContract(contract_id, overrides = {}) {
        const symbol = this.normaliseSymbol(overrides.symbol || '1HZ100V');
        const contract_type = overrides.contract_type || 'DIGITMATCH';
        const entry_tick = Number(overrides.entry_tick || this.getQuote(symbol));
        const exit_tick = Number(overrides.exit_tick || this.getQuote(symbol));
        const buy_price = Number(overrides.buy_price || 1);
        const sell_price = Number(overrides.sell_price || buy_price * (Math.random() > 0.5 ? 1.85 : 0));
        const now = Math.floor(Date.now() / 1000);

        return {
            barrier: overrides.barrier ?? 0,
            bid_price: overrides.status === 'open' ? buy_price : sell_price,
            buy_price,
            contract_id,
            contract_type,
            currency: 'USD',
            entry_tick,
            entry_tick_display_value: String(entry_tick),
            entry_tick_time: now,
            exit_tick,
            exit_tick_display_value: String(exit_tick),
            exit_tick_time: now + 1,
            is_completed: overrides.status === 'open' ? false : true,
            is_expired: overrides.status === 'open' ? 0 : 1,
            is_sold: overrides.status === 'open' ? 0 : 1,
            is_valid_to_sell: overrides.status === 'open' ? 1 : 0,
            longcode: overrides.longcode || `Matchestool virtual ${contract_type} contract on ${symbol}`,
            profit: overrides.status === 'open' ? 0 : Number((sell_price - buy_price).toFixed(2)),
            payout: Number(overrides.payout || buy_price * 1.95),
            sell_price: overrides.status === 'open' ? 0 : sell_price,
            shortcode: `MATCH_${contract_type}_${symbol}`,
            status: overrides.status || (sell_price >= buy_price ? 'won' : 'lost'),
            symbol,
            transaction_ids: {
                buy: contract_id,
                sell: contract_id + 1,
            },
            underlying: symbol,
        };
    }

    withMeta(request, response) {
        return {
            echo_req: request,
            provider: {
                name: 'matchestool.pro',
                url: this.provider_url,
            },
            ...response,
        };
    }
}
