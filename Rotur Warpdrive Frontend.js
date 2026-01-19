(function (Scratch) {
    'use strict';

    const API_BASE = 'https://api.rotur.dev/link';
    const API_USER = 'https://api.rotur.dev/me?auth=';

    let authCode = '';
    let token = '';
    let status = 'idle';
    let accountObj = null;
    let pollingInterval = null;

    async function loadQRCode() {
        if (window.QRCode) return;
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    async function createQRCodeDataURL(text, size) {
        await loadQRCode();
        const temp = document.createElement('div');
        new QRCode(temp, {
            text,
            width: size,
            height: size,
            correctLevel: QRCode.CorrectLevel.H
        });
        await new Promise(r => setTimeout(r, 50));
        const img = temp.querySelector('img');
        const canvas = temp.querySelector('canvas');
        let dataUrl = '';
        if (img) dataUrl = img.src;
        else if (canvas) dataUrl = canvas.toDataURL('image/png');
        temp.remove();
        return dataUrl;
    }

    function ensureOverlay() {
        let frame = document.getElementById('qrgen-frame');
        if (!frame) {
            frame = document.createElement('iframe');
            frame.id = 'qrgen-frame';
            frame.style.position = 'fixed';
            frame.style.border = 'none';
            frame.style.background = 'transparent';
            frame.style.pointerEvents = 'none';
            frame.style.zIndex = 999999999;
            document.body.appendChild(frame);
        }
        return frame;
    }

    function positionFrame(frame, size, yOffset) {
        const centerX = (window.innerWidth - size) / 2;
        const centerY = (window.innerHeight - size) / 2;
        frame.style.left = `${centerX}px`;
        frame.style.top = `${centerY + yOffset}px`;
    }

    function showQR(dataUrl, size, yOffset) {
        const frame = ensureOverlay();
        frame.srcdoc = `
            <html>
                <body style="margin:0;background:transparent;display:flex;align-items:center;justify-content:center;">
                    <img src="${dataUrl}" width="${size}" height="${size}" style="image-rendering:pixelated;">
                </body>
            </html>
        `;
        frame.style.width = size + 'px';
        frame.style.height = size + 'px';
        frame.style.display = 'block';

        positionFrame(frame, size, yOffset);

        window.onresize = () => {
            positionFrame(frame, size, yOffset);
        };
    }

    function hideQR() {
        const frame = document.getElementById('qrgen-frame');
        if (frame) frame.remove();
        window.onresize = null;
    }

    async function pollToken() {
        if (!authCode) return;
        status = 'checking';
        try {
            const res = await fetch(`${API_BASE}/user?code=${encodeURIComponent(authCode)}`);
            const json = await res.json();
            if (json.token) {
                token = json.token;
                status = 'linked';
                clearInterval(pollingInterval);
                pollingInterval = null;
                const userRes = await fetch(`${API_USER}${encodeURIComponent(token)}`);
                accountObj = await userRes.json();
            } else {
                status = 'waiting';
            }
        } catch {
            status = 'error';
        }
    }

    const ext = {
        getInfo() {
            return {
                id: 'roturwarpdrivefrontend',
                name: 'Rotur Warpdrive Frontend',
                color1: '#c571f0',
                color2: '#321640',
                blocks: [
                    { opcode: 'generateLinkCode', blockType: Scratch.BlockType.COMMAND, text: 'generate Rotur link code' },
                    { opcode: 'checkLinkStatus', blockType: Scratch.BlockType.COMMAND, text: 'check Rotur link status' },
                    { opcode: 'getLinkCode', blockType: Scratch.BlockType.REPORTER, text: 'link code' },
                    { opcode: 'getLinkToken', blockType: Scratch.BlockType.REPORTER, text: 'link token' },
                    { opcode: 'getLinkStatus', blockType: Scratch.BlockType.REPORTER, text: 'link status' },
                    { opcode: 'getUsername', blockType: Scratch.BlockType.REPORTER, text: 'username' },
                    { opcode: 'getAvatarURL', blockType: Scratch.BlockType.REPORTER, text: 'avatar URL' },
                    { opcode: 'getAccountObject', blockType: Scratch.BlockType.REPORTER, text: 'account object' },
                    {
                        opcode: 'showQR',
                        blockType: Scratch.BlockType.COMMAND,
                        text: 'show QR for [TEXT] size [SIZE] y offset [Y]',
                        arguments: {
                            TEXT: { type: Scratch.ArgumentType.STRING, defaultValue: 'https://rotur.dev/link' },
                            SIZE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 256 },
                            Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }
                        }
                    },
                    { opcode: 'hideQR', blockType: Scratch.BlockType.COMMAND, text: 'hide QR' }
                ]
            };
        },

        async generateLinkCode() {
            status = 'fetching';
            try {
                const res = await fetch(`${API_BASE}/code`);
                const json = await res.json();
                authCode = json.code || '';
                status = 'waiting';
                if (pollingInterval) clearInterval(pollingInterval);
                pollingInterval = setInterval(pollToken, 3000);
            } catch {
                status = 'error';
            }
        },

        async checkLinkStatus() { await pollToken(); },
        getLinkCode() { return authCode || ''; },
        getLinkToken() { return token || ''; },
        getLinkStatus() { return status; },
        getUsername() { return accountObj?.username || ''; },
        getAvatarURL() {
            return accountObj?.username
                ? `https://avatars.rotur.dev/${accountObj.username}`
                : '';
        },
        getAccountObject() { return accountObj || {}; },

        async showQR(args) {
            const text = String(args.TEXT || '');
            const size = Number(args.SIZE) || 256;
            const yOffset = Number(args.Y) || 0;
            const dataUrl = await createQRCodeDataURL(text, size);
            showQR(dataUrl, size, yOffset);
        },

        hideQR() { hideQR(); },
        _shutdown() {
            hideQR();
            if (pollingInterval) clearInterval(pollingInterval);
        },
        _getStatus() { return { status: 2, msg: 'Ready' }; }
    };

    Scratch.extensions.register(ext);

})(Scratch);
