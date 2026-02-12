const ImageKit = require('@imagekit/nodejs');
const { toFile } = require('@imagekit/nodejs');

var imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
})

async function uploadFile(file, folder = "cohort-audio") {
    const uploadable = await toFile(file.buffer, file.originalname);
    return imagekit.files.upload({
        file: uploadable,
        fileName: file.originalname,
        folder
    });
}

module.exports = uploadFile;
