/**
 * ZPHS Jami Alumni Reunion - website registration receiver
 * Saves the uploaded photo to Drive and submits Name, Village, Phone and Photo
 * into the user's Google Form.
 */

const FORM_ID = '1FAIpQLScCjRI3U068Mz0Cf6A72dAB1QCd3JousvM-7jFlRM1R9YE4Vg';
const DRIVE_FOLDER_NAME = 'ZPHS Jami Alumni Photos';
const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB

function doGet() {
  return ContentService
    .createTextOutput('ZPHS Jami Alumni registration service is running.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('No registration data received.');
    }

    const data = JSON.parse(e.postData.contents);
    const name = String(data.name || '').trim();
    const village = String(data.village || '').trim();
    const phone = String(data.phone || '').trim();
    const photoName = String(data.photoName || 'photo.jpg').trim();
    const photoType = String(data.photoType || 'image/jpeg').trim();
    const photoBase64 = String(data.photoBase64 || '');

    if (!name || !village || !phone || !photoBase64) {
      throw new Error('Name, Village, Phone and Photo are required.');
    }

    const estimatedBytes = Math.floor(photoBase64.length * 3 / 4);
    if (estimatedBytes > MAX_PHOTO_BYTES) {
      throw new Error('Photo is too large. Please choose a photo under 8 MB.');
    }

    // Save the photo to Drive first.
    const folder = getOrCreatePhotoFolder_();
    const safeName = makeSafeFileName_(name + '_' + photoName);
    const bytes = Utilities.base64Decode(photoBase64);
    const blob = Utilities.newBlob(bytes, photoType, safeName);
    const photoFile = folder.createFile(blob);

    // Submit the registration into the actual Google Form.
    const form = FormApp.openById(FORM_ID);
    const response = form.createResponse();
    const items = form.getItems();

    const nameItem = findItemByTitle_(items, 'Name');
    const villageItem = findItemByTitle_(items, 'Village');
    const phoneItem = findItemByTitle_(items, 'Phone');
    const photoItem = findItemByTitle_(items, 'Photo');

    if (!nameItem || !villageItem || !phoneItem || !photoItem) {
      throw new Error('Could not find one or more form questions. Make sure the Google Form questions are titled exactly: Name, Village, Phone, Photo.');
    }

    response.withItemResponse(nameItem.asTextItem().createResponse(name));
    response.withItemResponse(villageItem.asTextItem().createResponse(village));
    response.withItemResponse(phoneItem.asTextItem().createResponse(phone));
    response.withItemResponse(photoItem.asFileUploadItem().createResponse([photoFile.getId()]));
    response.submit();

    return json_({
      ok: true,
      message: 'Registration submitted successfully.',
      photoUrl: photoFile.getUrl()
    });
  } catch (err) {
    console.error(err);
    return json_({
      ok: false,
      message: err && err.message ? err.message : 'Registration failed.'
    });
  }
}

function findItemByTitle_(items, title) {
  const wanted = title.trim().toLowerCase();
  for (const item of items) {
    if (String(item.getTitle()).trim().toLowerCase() === wanted) return item;
  }
  return null;
}

function getOrCreatePhotoFolder_() {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty('PHOTO_FOLDER_ID');

  if (savedId) {
    try {
      return DriveApp.getFolderById(savedId);
    } catch (err) {}
  }

  const folder = DriveApp.createFolder(DRIVE_FOLDER_NAME);
  props.setProperty('PHOTO_FOLDER_ID', folder.getId());
  return folder;
}

function makeSafeFileName_(name) {
  return name.replace(/[\\/:*?"<>|#%{}]/g, '_').substring(0, 180);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Run once manually to authorize access and verify the form questions. */
function setup() {
  const form = FormApp.openById(FORM_ID);
  const titles = form.getItems().map(i => i.getTitle());
  Logger.log('Form: ' + form.getTitle());
  Logger.log('Questions: ' + titles.join(' | '));
  getOrCreatePhotoFolder_();
}
