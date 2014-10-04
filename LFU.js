/*
за url скрывается скрипт принимающий 3 типа запросов(requestType):
1. init => возвращает token для загрузки файла по частям(к каждой отправляемой части прилагается выданый токен)
2. uploadPart
3. finishUpload
*/

function LFU(url, file){
	//тут можно вставить проверку URL по regexp. Но мне лень.
	this.url = url;
	
	if(file.value === '')
		throw new Error("File is not selected");
	this.file = file;
		
	
	this.onprogress = null;
	this.onfinish = null;
	
	
	this.partSize = 1024 * 512;//загружаем кусками по 0.5мб
	
	this.progress = 0;
	this.progressPoints = {
		hashCalculated: 0.1,
		uploaderCreated: 0.1,
		byteUploaded: 0.7 / this.file.size,
		uploadFinished: 0.1
	};
	
	
	
	this.hash = null;
	this.uploaderToken = null;
	
	this.updateProgress();
}

LFU.prototype.getProgress = function(){
	return this.progress;
};
LFU.prototype.updateProgress = function(){
	if(this.onprogress !== null)
		this.onprogress(this.progress);
};
LFU.prototype.increaseProgress = function(val){
	if(val < 0)
		throw new Error("val < 0");
	this.progress += val;
	if(this.progress > 1)
		this.progress = 1;
	
	this.updateProgress();
};
LFU.prototype.finishProgress = function(){
	this.progress = 1;
	this.updateProgress();
};


LFU.prototype.sendFile = function(){//selectedFile - ссылка на input type="file" с выбранным файлом. callback(token) - функция, которя вызовется после загрузки
	var fileReader = new FileReader();
	
	var instance = this;
	fileReader.onloadend = function(event){
		if(fileReader.readyState !== 2)
			throw new Error("File reading error");
		
		instance.hash = crc32hex(fileReader.result);
		instance.increaseProgress(instance.progressPoints.hashCalculated);
		instance.createUploader();
	};
	fileReader.readAsArrayBuffer(this.file);
};


LFU.prototype.createUploader = function(){
	var uploaderInitForm = new FormData();
	uploaderInitForm.append('requestType', 'init');
	uploaderInitForm.append('fileName', this.file.name);
	uploaderInitForm.append('fileSize', this.file.size);
	uploaderInitForm.append('hash', this.hash);
	
	var uploaderInitRequest = new XMLHttpRequest();
	uploaderInitRequest.open('post', this.url);
	
	var instance = this;
	uploaderInitRequest.onreadystatechange = function(event){
		if(event.target.readyState === 4){
			var response = JSON.parse(event.target.responseText);
			if(response.errno !== 0)
				throw new Error(response.what);
			
			instance.uploaderToken = response.token;
			instance.increaseProgress(instance.progressPoints.uploaderCreated);
			instance.sendFileParts();			
		}
	};
	
	uploaderInitRequest.send(uploaderInitForm);
}

	
LFU.prototype.sendFileParts = function(start){
	if(typeof start === 'undefined')
		start = 0;	
	
	if(start >= this.file.size){
		this.finishUpload();
		return;
	}
	
	var currentSize = Math.min(this.file.size - start, this.partSize);
	var part = this.file.slice(start, start + currentSize);
	
	var currentFilePart = new FormData();
	currentFilePart.append('requestType', 'uploadPart');
	currentFilePart.append('token', this.uploaderToken);
	currentFilePart.append('partSize', currentSize);
	currentFilePart.append('filePart', part);
	
	
	var request = new XMLHttpRequest();
	request.open('post', this.url);
	
	var instance = this;
	request.onreadystatechange = function(event){
		if(event.target.readyState === 4){
			var response = JSON.parse(event.target.responseText);
			if(response.errno !== 0)
				throw new Error(response.what);
			instance.increaseProgress(instance.progressPoints.byteUploaded * currentSize);
			instance.sendFileParts(start + currentSize);
		}
	};
	
	request.send(currentFilePart);
}
	
	
LFU.prototype.finishUpload = function(){
	var fileInfo = new FormData();
	fileInfo.append('requestType', 'finishUpload');
	fileInfo.append('token', this.uploaderToken);
		
	
	var request = new XMLHttpRequest();
	request.open('post', this.url);
	
	var instance = this;
	request.onreadystatechange = function(event){
		if(event.target.readyState === 4){
			var response = JSON.parse(event.target.responseText);
			if(response.errno !== 0)
				throw new Error(response.what);
			
			instance.increaseProgress(instance.progressPoints.uploadFinished);
			var token = response.token;
			if(instance.onfinish !== null)
				instance.onfinish(token);
		}
	};
	
	request.send(fileInfo);
}
	
	
	
	
	
	
	
	
	
