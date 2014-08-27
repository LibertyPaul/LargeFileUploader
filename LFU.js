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
	uploaderInitRequest.open('post', url);
	
	
	uploaderInitRequest.onreadystatechange = function(event){
		if(this.readyState === 4){
			var response = JSON.parse(uploaderInitRequest.responseText);
			if(response.errno !== 0)
				throw new Error(response.what);
			
			var token = response.token;
			//setProgressBar(fileObj.file.size / 10);
			//showInfo("Начинаю загружать файл");
			sendFileParts(0, url, selectedFile, token);			
		}
	};
	
	uploaderInitRequest.send(uploaderInitForm);
}

	
function sendFileParts(start, url, selectedFile, token){
	if(start >= selectedFile.size){
		finishUpload(url, token);
		return;
	}
	const partSize = 1024 * 512;//загружаем кусками по 0.5мб
	
	var currentSize = Math.min(selectedFile.size - start, partSize);
	var part = selectedFile.slice(start, start + currentSize);
	
	var currentFilePart = new FormData();
	currentFilePart.append('requestType', 'uploadPart');
	currentFilePart.append('token', token);
	currentFilePart.append('partSize', currentSize);
	currentFilePart.append('filePart', part);
	
	
	var request = new XMLHttpRequest();
	request.open('post', url);
	/*request.upload.addEventListener('progress', function(evt){
		updateProgressBar(evt.loaded);
	});*/
	
	request.onreadystatechange = function(event){
		if(this.readyState === 4){
			var response = JSON.parse(request.responseText);
			if(response.errno !== 0)
				throw new Error(response.what);
			//setProgressBar(currentSize);
			sendFileParts(start + currentSize, url, selectedFile, token);
		}
	};
	
	request.send(currentFilePart);
}
	
	
function finishUpload(url, token){
	var fileInfo = new FormData();
	fileInfo.append('requestType', 'finishUpload');
	fileInfo.append('token', token);
		
	
	var request = new XMLHttpRequest();
	request.open('post', url);
	
	
	request.onreadystatechange = function(event){
		if(this.readyState === 4){
			var response = JSON.parse(request.responseText);
			if(response.errno !== 0)
				throw new Error(response.what);
			
			//setProgressBar(fileObj.file.size / 10);
			//showSuccess("Файл загружен");
			var token = response.token;
			alert("Success: " + token);
			//тут надо вызвать следующую функцию
		}
	};
	
	request.send(fileInfo);
}
	
	
	
	
	
	
	
	
	
