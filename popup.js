document.addEventListener('DOMContentLoaded', async () => {
  const display = document.getElementById('display');
  //  start refresh at 8:59:00 PM or 8:59:30
  // Get the current active tab
  // Auto Refresh Logic
  const hourInput = document.getElementById('refresh-hour');
  const minuteInput = document.getElementById('refresh-minute');
  const secondInput = document.getElementById('refresh-second');
  const msInput = document.getElementById('refresh-ms');
  const ampmInput = document.getElementById('refresh-ampm');
  const clearBtn = document.getElementById('clear-refresh');
  const statusDiv = document.getElementById('refresh-status');
  const pageLoadTime = Date.now();



  function formatTime(timeString) {
    if (!timeString) return '';
    const parts = timeString.split(':');
    const hours = parts[0];
    const minutes = parts[1];
    const seconds = parts[2] || '00';
    const milliseconds = parts[3] || '000';

    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(seconds);

    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) + `.${milliseconds}`;
  }

  function updateUI(time) {
    if (!time) {
      hourInput.value = '';
      minuteInput.value = '';
      secondInput.value = '';
      msInput.value = '';
      ampmInput.value = '';
      return;
    }

    const parts = time.split(':');
    let hours = parseInt(parts[0]);
    const minutes = parts[1];
    const seconds = parts[2] || '00';
    const milliseconds = parts[3] || '000';

    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'

    hourInput.value = hours;
    minuteInput.value = minutes;
    secondInput.value = seconds;
    msInput.value = milliseconds;
    ampmInput.value = ampm;
  }

  // State to hold the current scheduled time
  let currentScheduledTime = null;

  function updateStatus(time) {
    currentScheduledTime = time; // Update state
    if (!time) {
      updateUI(null);
    }
    renderStatus();
  }

  function renderStatus() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString();
    const msStr = now.getMilliseconds().toString().padStart(3, '0');
    const nowStr = timeStr.match(/ (AM|PM)$/i) ? timeStr.replace(/ (AM|PM)$/i, `.${msStr} $1`) : `${timeStr}.${msStr}`;

    if (currentScheduledTime) {
      statusDiv.innerHTML = `Refresh set for <span style="color: #3ba55c; font-weight: bold;">${formatTime(currentScheduledTime)}</span><br><span style="color: #b9bbbe; font-size: 11px;">Current: ${nowStr}</span>`;
    } else {
      statusDiv.innerHTML = `Auto-refresh not set<br><span style="color: #b9bbbe; font-size: 11px;">Select a time to auto-set</span><br><span style="color: #b9bbbe; font-size: 11px;">Current Time: ${nowStr}</span>`;
      // Don't call updateUI(null) here constantly to prevent clearing inputs while typing
    }
  }

  // Update clock frequently for ms
  setInterval(renderStatus, 50);

  // Auto-save logic
  function saveTime() {
    // Default: 8:59:59.989 PM
    const DEFAULT_HOUR = 8;
    const DEFAULT_MINUTE = 59;
    const DEFAULT_SECOND = 59;
    const DEFAULT_MS = 960;
    const DEFAULT_AMPM = 'PM';

    let h = parseInt(hourInput.value);
    let m = parseInt(minuteInput.value);
    let s = parseInt(secondInput.value);
    let ms = parseInt(msInput.value);
    let ampm = ampmInput.value;

    // Use defaults when fields are empty
    if (isNaN(h)) h = DEFAULT_HOUR;
    if (isNaN(m)) m = DEFAULT_MINUTE;
    if (isNaN(s)) s = DEFAULT_SECOND;
    if (isNaN(ms)) ms = DEFAULT_MS;
    if (!ampm) ampm = DEFAULT_AMPM;

    // Convert 12-hour time to 24-hour time
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;

    // Pad values
    const hStr = h.toString().padStart(2, '0');
    const mStr = m.toString().padStart(2, '0');
    const sStr = s.toString().padStart(2, '0');
    const msStr = ms.toString().padStart(3, '0');

    const time = `${hStr}:${mStr}:${sStr}:${msStr}`;

    chrome.storage.local.set({ refreshTime: time }, () => {
      updateStatus(time);
    });
  }

  [hourInput, minuteInput, secondInput, msInput, ampmInput].forEach(el => {
    el.addEventListener('change', saveTime);
    el.addEventListener('keyup', saveTime); // Also save on typing
  });

  // Load saved time
  chrome.storage.local.get(['refreshTime'], (result) => {
    if (result && result.refreshTime) {
      updateUI(result.refreshTime);
      updateStatus(result.refreshTime);
    } else {
      updateStatus(null);
    }
  });

  clearBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['refreshTime'], () => {
      updateStatus(null);
    });
  });
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.storage.local.get(['queueStart'], result => {
    if (!result.queueStart) {
      chrome.storage.local.set({
        queueStart: Date.now()
      });
    }
  });

  try {

    const url = new URL(tab.url);
    const qpdataEncoded = url.searchParams.get('qpdata');

    console.log("Raw qpdata:", qpdataEncoded);


    if (!qpdataEncoded) {
      display.innerHTML = "<p>No queue data found in this URL.</p>";
      return;
    }


    let decoded;

    try {
      decoded = decodeURIComponent(qpdataEncoded);
    } catch {
      decoded = qpdataEncoded;
    }


    let data;

    try {
      data = JSON.parse(decoded);
    } catch {

      const base64Decoded = atob(decoded);
      data = JSON.parse(base64Decoded);

    }


    console.log("Queue Data:", data);


    const queues = Array.isArray(data) ? data : [data];


    display.innerHTML = queues.map(queue => {


      /*
        Queue Start Tracking
      */

      const queueKey = `queue_${queue.ticket}`;

      chrome.storage.local.get([queueKey], result => {

        if (!result[queueKey]) {

          chrome.storage.local.set({
            [queueKey]: {
              startTime: Date.now(),
              ticket: queue.ticket,
              item: queue.item?.name
            }
          });

        }

      });

      /*
        Product Info
      */
      const metadata = queue.customMetadata ?? {};
      const item = metadata.item ?? {};

      const itemName = item.name ?? "Unknown Item";

      const price = item.currentPrice ?? "N/A";

      const itemId = item.itemID ?? queue.itemId ?? "N/A";

      const image = item.imageURL ?? "";

      const likelihood = metadata.admissionLikelihood ?? "Unknown";

      /*
        Queue Info
      */

      const turnTime =
        queue.expectedTurnTimeUnixTimestamp
          ? new Date(queue.expectedTurnTimeUnixTimestamp)
            .toLocaleTimeString()
          : "N/A";

      const refreshTime =
        queue.nextRefreshUnixTimestamp
          ? new Date(queue.nextRefreshUnixTimestamp)
            .toLocaleTimeString()
          : "N/A";

      const expireTime =
        queue.expires
          ? new Date(queue.expires)
            .toLocaleString()
          : "N/A";
      return `

        <div class="data-item">
            <div class="label">Ticket Number</div>
            <div class="value">
                ${queue.ticket ?? "Unknown"}
            </div>
        </div>
        <div class="data-item">
            <div class="label">State</div>
            <div class="value">
                ${queue.state ?? "Unknown"}
            </div>
        </div>
        <div class="data-item">
            <div class="label">Likelihood</div>
            <div class="value">
                ${likelihood}
            </div>
        </div>
        <div class="data-item">
            <div class="label">Expected Turn</div>
            <div class="value">
                ${turnTime}
            </div>
        </div>
        <div class="data-item">
            <div class="label">Next Refresh</div>
            <div class="value">
                ${refreshTime}
            </div>
        </div>
        <div class="data-item">
            <div class="label">Expires</div>
            <div class="value">
                ${expireTime}
            </div>
        </div>
        <div class="data-item">

            <div class="label">
                Product
            </div>
            ${image
          ?
          `<img 
                    src="${image}" 
                    style="
                    width:100px;
                    border-radius:6px;
                    margin:8px 0;">
                `
          :
          ""
        }

            <div class="value">
                ${itemName}
            </div>

        </div>

        <div class="data-item">
            <div class="label">Price</div>
            <div class="value">
                ${price}
            </div>
        </div>

        <div class="data-item">
            <div class="label">Item ID</div>
            <div class="value">
                ${itemId}
            </div>
        </div>

        <div class="data-item">
            <div class="label">Queue Timer</div>
            <div 
                class="value"
                id="timer-${queue.ticket}">
                Loading...
            </div>
        </div>

        <hr>

        `;


    }).join("");
    /*
      Update Queue Timers
    */
    queues.forEach(queue => {

      const queueKey = `queue_${queue.ticket}`;
      setInterval(() => {
        chrome.storage.local.get([queueKey], result => {

          const info = result[queueKey];

          if (!info)
            return;

          const elapsed =
            Date.now() - info.startTime;

          const seconds =
            Math.floor(elapsed / 1000);

          const h =
            Math.floor(seconds / 3600);

          const m =
            Math.floor(
              (seconds % 3600) / 60
            );

          const s =
            seconds % 60;

          const timer =
            `${h.toString().padStart(2, "0")}:` +
            `${m.toString().padStart(2, "0")}:` +
            `${s.toString().padStart(2, "0")}`;

          const element =
            document.getElementById(
              `timer-${queue.ticket}`
            );

          if (element)
            element.textContent = timer;
        });

      }, 1000);
    });



  } catch (e) {

    console.error(
      "Queue decoder error:",
      e
    );

    display.innerHTML =
      `
    <p>Error decoding data.</p>
    <pre>${e.message}</pre>
    `;

  }
});

