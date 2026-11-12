# Product Assistant — n8n custom frontend

This folder contains a custom dark/purple shopping assistant interface:
- `index.html` — page structure
- `style.css` — CelestAI-inspired layout and styling
- `script.js` — chat UI, local conversation list, and n8n connection

## 1. n8n setup

1. Open your **When chat message received** (Chat Trigger) node.
2. Turn on **Make Chat Publicly Available**.
3. Choose **Embedded Chat** / webhook mode (the option that exposes the Chat URL).
4. Set **Allowed Origins (CORS)** to your deployed site origin, for example:
   `https://your-site-name.netlify.app`
   During a quick test you can temporarily use `*`, but restrict it to your own site when deployed.
5. For the first test, use a non-streaming response mode such as **When Last Node Finishes**.
6. Ensure the AI Agent is the last response-producing node and returns its answer in `output` or `text`.
7. Save and activate/publish the workflow.

The same `sessionId` is sent with each message so your connected n8n Memory can maintain context. If you want n8n itself to rehydrate prior messages, configure Chat Trigger **Load Previous Session → From Memory** and connect the same compatible memory node to both Chat Trigger and AI Agent. This frontend currently keeps the visible transcript/history in this browser's local storage.

## 2. Confirm the webhook URL

The `script.js` file already contains the webhook URL you shared:
`https://velor.app.n8n.cloud/webhook/36a95220-c279-4f8b-a71f-e0ec999c281d/chat`

If n8n shows a different **Production Chat URL**, replace `N8N_CHAT_URL` near the top of `script.js`.

## 3. Test on your computer

1. Keep all three files in the same folder.
2. Double-click `index.html` to open it in your browser.
3. Send a simple test message, such as: `Hello`.
4. If it fails, check the browser Console (press F12) and the n8n Executions page.

## 4. Publish with Netlify

1. Sign in at https://app.netlify.com/
2. On the dashboard, choose **Add new project** / **Deploy manually** (wording may vary).
3. Drag the whole `product-assistant` folder (or its ZIP contents) into the manual deploy area.
4. Netlify will give you a URL ending in `netlify.app`.
5. Copy the exact site origin, such as `https://your-name.netlify.app`.
6. Add that origin to the Chat Trigger's **Allowed Origins (CORS)** field in n8n, save, and publish/activate the workflow.
7. Refresh your Netlify website and test again.

## Notes

- Do not share private API keys in frontend code. This project uses your public n8n Chat Trigger URL.
- The chat history is stored in this browser only. It is not a cross-device account history.
- If the browser reports a CORS error, add the exact Netlify origin to Allowed Origins (CORS) and redeploy/reload.
- If the request reaches n8n but the UI shows an object instead of a readable answer, check the AI Agent's final output field. The frontend looks for `output`, `text`, `reply`, `response`, `message`, or `answer`.
