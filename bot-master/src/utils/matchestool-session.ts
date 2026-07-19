type TMatchestoolAccountType = 'demo' | 'real';

export const MATCHESTOOL_DEMO_LOGINID = 'VRTC1000001';
export const MATCHESTOOL_REAL_LOGINID = 'CR1000001';

export const MATCHESTOOL_LOCAL_ACCOUNTS = [
    {
        account_type: 'demo' as TMatchestoolAccountType,
        balance: 10000,
        currency: 'USD',
        is_virtual: 1,
        loginid: MATCHESTOOL_DEMO_LOGINID,
        token: 'matchestool-demo-token',
    },
    {
        account_type: 'real' as TMatchestoolAccountType,
        balance: 1000,
        currency: 'USD',
        is_virtual: 0,
        loginid: MATCHESTOOL_REAL_LOGINID,
        token: 'matchestool-real-token',
    },
];

export const getMatchestoolAccountsList = () =>
    MATCHESTOOL_LOCAL_ACCOUNTS.reduce<Record<string, string>>((accounts, account) => {
        accounts[account.loginid] = account.token;
        return accounts;
    }, {});

export const getMatchestoolClientAccounts = () =>
    MATCHESTOOL_LOCAL_ACCOUNTS.reduce<Record<string, Record<string, string | number>>>((accounts, account) => {
        accounts[account.loginid] = {
            account_type: account.account_type,
            currency: account.currency,
            is_virtual: account.is_virtual,
            loginid: account.loginid,
            token: account.token,
        };
        return accounts;
    }, {});

export const getPreferredMatchestoolAccount = (preferred_account: TMatchestoolAccountType = 'demo') =>
    MATCHESTOOL_LOCAL_ACCOUNTS.find(account => account.account_type === preferred_account) ?? MATCHESTOOL_LOCAL_ACCOUNTS[0];

export const establishMatchestoolSession = (
    preferred_account: TMatchestoolAccountType = 'demo',
    should_redirect = true
) => {
    const active_account = getPreferredMatchestoolAccount(preferred_account);
    const account_param = active_account.account_type === 'demo' ? 'demo' : active_account.currency;

    localStorage.setItem('accountsList', JSON.stringify(getMatchestoolAccountsList()));
    localStorage.setItem('clientAccounts', JSON.stringify(getMatchestoolClientAccounts()));
    localStorage.setItem('authToken', active_account.token);
    localStorage.setItem('active_loginid', active_account.loginid);
    localStorage.setItem('client.country', 'ke');
    sessionStorage.setItem('query_param_currency', account_param);
    document.cookie = 'logged_state=true; path=/; max-age=2592000; SameSite=Lax';

    if (!should_redirect) return;

    const next_params = new URLSearchParams(window.location.search);
    next_params.set('account', account_param);
    const safe_pathname =
        window.location.pathname.includes('callback') || window.location.pathname.includes('endpoint')
            ? '/'
            : window.location.pathname || '/';

    window.location.assign(`${window.location.origin}${safe_pathname}?${next_params.toString()}`);
};
