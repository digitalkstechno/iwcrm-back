const axios = require('axios');
const FormData = require('form-data');
const Setting = require('../model/setting');

exports.generateLeadFlow = async (req, res) => {
  try {
    const setting = await Setting.findOne({ configType: 'meta_whatsapp' });
    if (!setting || !setting.metaDomain || !setting.metaWabaId || !setting.metaChannelToken) {
      return res.status(400).json({ status: 'Fail', message: 'Missing Meta WABA ID, Domain, or Token in settings' });
    }

    const domain = setting.metaDomain.replace(/\/+$/, '');
    const cleanToken = setting.metaChannelToken.replace(/\s+/g, '');
    const headers = {
      'Authorization': `Bearer ${cleanToken}`,
      'Content-Type': 'application/json'
    };

    // 1. Create Flow
    const createFlowUrl = `${domain}/${setting.metaWabaId}/flows`;
    const createPayload = {
      name: `lead_form_${Date.now()}`,
      categories: ["LEAD_GENERATION"]
    };

    const createResponse = await axios.post(createFlowUrl, createPayload, {
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        'Content-Type': 'application/json'
      }
    });

    const flowId = createResponse.data.id;
    if (!flowId) {
      throw new Error('Flow creation failed, no ID returned.');
    }

    // 2. Upload Flow JSON Asset
    const flowJson = {
      "version": "3.1",
      "data_api_version": "3.0",
      "routing_model": {
        "LEAD_FORM": []
      },
      "screens": [
        {
          "id": "LEAD_FORM",
          "title": "Contact Details",
          "data": {},
          "layout": {
            "type": "SingleColumnLayout",
            "children": [
              {
                "type": "Form",
                "name": "flow_path",
                "children": [
                  {
                    "type": "TextInput",
                    "name": "contactName",
                    "label": "Full Name",
                    "required": true
                  },
                  {
                    "type": "TextInput",
                    "name": "companyName",
                    "label": "Company Name (Optional)",
                    "required": false
                  },
                  {
                    "type": "TextInput",
                    "name": "city",
                    "label": "City",
                    "required": true
                  },
                  {
                    "type": "Footer",
                    "label": "Submit",
                    "on-click-action": {
                      "name": "complete",
                      "payload": {
                        "contactName": "${form.contactName}",
                        "companyName": "${form.companyName}",
                        "city": "${form.city}"
                      }
                    }
                  }
                ]
              }
            ]
          }
        }
      ]
    };

    const uploadUrl = `${domain}/${flowId}/assets`;
    const formData = new FormData();
    formData.append('name', 'flow.json');
    formData.append('asset_type', 'FLOW_JSON');
    formData.append('file', Buffer.from(JSON.stringify(flowJson)), {
      filename: 'flow.json',
      contentType: 'application/json'
    });

    await axios.post(uploadUrl, formData, {
      headers: {
        'Authorization': `Bearer ${cleanToken}`,
        ...formData.getHeaders()
      }
    });

    // 3. Publish Flow
    const publishUrl = `${domain}/${flowId}/publish`;
    await axios.post(publishUrl, {}, { headers });

    // 4. Save to DB
    setting.botFlowId = flowId;
    await setting.save();

    return res.status(200).json({
      status: 'Success',
      message: 'Flow generated and published successfully',
      data: { flowId }
    });

  } catch (error) {
    console.error('Flow Generation Error:', error.response?.data || error.message);
    return res.status(500).json({
      status: 'Fail',
      message: error.response?.data?.error?.message || error.message
    });
  }
};
