import {
  LINE_NO_METADATA_KEYS,
  firstLineNoValue,
  lineNoFromMetadata,
} from '../../../utils/line-no-metadata.js';

export function createPropertyPanel(propPanel, propContent) {
  function lineNoForItem(item) {
    const meta = item?.rawMeta || {};
    return firstLineNoValue(
      lineNoFromMetadata(meta, LINE_NO_METADATA_KEYS),
      item?.lineNo,
      item?.object3D?.userData?.lineNo
    );
  }

  return {
    show: (item) => {
        if (!item) {
            propPanel.style.display = 'none';
            return;
        }

        const lineNo = lineNoForItem(item);
        let html = `<div style="font-family: monospace; font-size: 12px; margin-bottom: 10px;">
          <strong>ID:</strong> ${item.id || 'N/A'}<br/>
          <strong>Type:</strong> ${item.type || 'N/A'}<br/>
          <strong>Ref No:</strong> ${item.refNo || 'N/A'}<br/>
          <strong>Line No.:</strong> ${lineNo || 'N/A'}<br/>
          <strong>Bore:</strong> ${item.bore || 'N/A'}<br/>
        </div>`;

        html += `<strong>Fallback Properties</strong><div style="background: rgba(0,0,0,0.5); padding: 5px; border-radius: 4px; margin-top: 5px; max-height: 200px; overflow-y: auto;">`;
        html += `<table style="width: 100%; text-align: left; border-collapse: collapse;">`;

        for (const [key, value] of Object.entries(item.rawMeta && Object.keys(item.rawMeta).length > 0 ? item.rawMeta : { uuid: item.uuid, name: item.object3D?.name })) {
            if (value === null || value === undefined || value === '') continue;
            html += `<tr>
              <td style="padding: 4px; border-bottom: 1px solid #444; color: #aaa; width: 40%; word-break: break-word;">${key}</td>
              <td style="padding: 4px; border-bottom: 1px solid #444; color: #fff; word-break: break-word;">${value}</td>
            </tr>`;
        }
        html += `</table></div>`;

        propContent.innerHTML = html;
        propPanel.style.display = 'block';
    },
    hide: () => {
        propPanel.style.display = 'none';
    }
  };
}
