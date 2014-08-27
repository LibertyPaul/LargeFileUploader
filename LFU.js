const partSize = 1024 * 512;//загружаем кусками по 0.5мб


/*
за url скрывается скрипт принимающий 3 типа запросов(requestType):
1. init => возвращает token для загрузки файла по частям(к каждой отправляемой части прилагается выданый токен)
2. uploadPart
3. finishUpload
*/



function sendFile(url, selectedFile){//selectedFile - ссылка на input type="file" с выбранным файлом. additionalInfo - объект с любой информацией.
	if(selectedFile.value === '')
		throw new Error("File is not selected");
		
	//тут можно вставить проверку URL по regexp. Но мне лень.

	var fileReader = new FileReader();
	fileReader.readAsArrayBuffer(selectedFile);
	
	fileReader.onloadend = function(){
		if(fileReader.readyState !== 2)
			throw new Error("File reading error");
		
		var hash = crc32hex(fileReader.result);
		createUploader(url, selectedFile, hash);
	};
}


function createUploader(url, selectedFile, hash){
	var uploaderInitForm = new FormData();
	uploaderInitForm.append('requestType', 'init');
	uploaderInitForm.append('fileName', selectedFile.name);
	uploaderInitForm.append('fileSize', selectedFile.size);
	uploaderInitForm.append('hash', hash);
	
	var uploaderInitRequest = new XMLHttpRequest();
	uploaderInitRequest.open('post', url, true);
	uploaderInitRequest.responseType = "json";
	uploaderInitRequest.send(uploaderInitForm);
	
	
	uploaderInitRequest.onreadystatechange = function(){
		if(uploaderInitRequest.readyState === 4){
			if(uploaderInitRequest.response.errno !== 0)
				throw new Error(uploaderInitRequest.response.what);
			
			var token = uploaderInitRequest.response.token;
			//setProgressBar(fileObj.file.size / 10);
			//showInfo("Начинаю загружать файл");
			sendFile(0, url, selectedFile, token);			
		}
	};


	
function sendFile(start, url, selectedFile, token){
	if(start >= selectedFile.size){
		finishUpload(url, token);
		return;
	}
	var currentSize = Math.min(selectedFile.size - start, partSize);
	var part = selectedFile.slice(start, start + currentSize);
	
	var currentFilePart = new FormData();
	currentFilePart.append('requestType', 'uploadPart');
	currentFilePart.append('token', token);
	currentFilePart.append('partSize', currentSize);
	currentFilePart.append('filePart', part);
	
	
	var request = new XMLHttpRequest();
	request.open('post', url, true);
	request.responseType = 'json';
	/*request.upload.addEventListener('progress', function(evt){
		updateProgressBar(evt.loaded);
	});*/
	request.send(currentFilePart);
	
	request.onreadystatechange = function(){
		if(request.readyState === 4){
			if(request.response.errno !== 0)
				throw new Error(response.what);
			//setProgressBar(currentSize);
			sendFile(start + currentSize, url, selectedFile, token);
		}
	};
}
	
	
function finishUpload(url, token){
	var fileInfo = new FormData();
	fileInfo.append('requestType', 'finishUpload');
	fileInfo.append('token', token);
	
	fileInfo.append('additionalInfo', JSON.stringify(additionalInfo));
	
	
	var request = new XMLHttpRequest();
	request.open('post', finishUploadURL, true);
	request.responseType = 'json';
	
	request.send(fileInfo);
	
	request.onreadystatechange = function(){
		if(request.readyState === 4){
			if(request.response.errno !== 0)
				throw new Error(request.response.what);
			
			//setProgressBar(fileObj.file.size / 10);
			//showSuccess("Файл загружен");
			var token = request.response.token;
			//тут надо вызвать следующую функцию
		}
	};
}
	
	
	
	
	
	
	
	
	
