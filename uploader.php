<?
require_once("config.php");

function exceptionHandler($exception){
	echo json_encode(array('errno' => -1, 'what' => $exception->getMessage()));
	exit;
}
set_exception_handler('exceptionHandler');//нафиг лишние try catch.


if(isset($_REQUEST["requestType"]) === false)
	throw new Exception('"requestType" parameter is missing');


switch($_REQUEST["requestType"]){
	case "init":
		if(isset($_REQUEST["fileName"], $_REQUEST["fileSize"], $_REQUEST["hash"]) === false)
			throw new Exception('some parameters are missing');
		
		$token = init($_REQUEST["fileName"], $_REQUEST["fileSize"], $_REQUEST["hash"]);
		echo json_encode(array('errno' => 0, 'token' => $token));
		break;
	
	case "uploadPart":
		if(isset($_REQUEST["token"], $_REQUEST["partSize"], $_FILES["filePart"]) === false)
			throw new Exception('some parameters are missing');
		
		uploadPart($_REQUEST["token"], $_REQUEST["partSize"], $_FILES["filePart"]);
		echo json_encode(array('errno' => 0));
		break;
		
	case "finishUpload":
		if(isset($_REQUEST["token"]) === false)
			throw new Exception('some parameters are missing');
		
		$token = finishUpload($_REQUEST["token"]);
		echo json_encode(array('errno' => 0, 'token' => $token));
		break;
	
	default:
		throw new Exception('unknown request type');
}









function isFileNameValid($fileName){
	$length = strlen($fileName);
	if($length > 255)
		return false;//не принимаем файлы с именем > 255 символов
		
	for($i = 0; $i < $length; ++$i)
		if($fileName[$i] === '\\' || $fileName[$i] === '/')//в юниксах любое имя без слешей корректно. + спасет от /../../../ хака
			return false;
	return true;
}

function init($fileName, $fileSize, $hash){
	$sql = new mysqli(HOST, DBuser, DBpass, DBname);
	if(!$sql)
		throw new Exception("MySQL connection error");
	
	$sql->set_charset("utf8");
	
	if(is_numeric($fileSize) === false || $fileSize < 0)
		throw new Exception("Incorrect file size");
	
	if(isFileNameValid($fileName) === false)
		throw new Exception("Incorrect file name");
	
	
	$fileName = $sql->real_escape_string($fileName);
	$fileSize = $sql->real_escape_string($fileSize);
	$hash = $sql->real_escape_string($hash);
	
	$token = $sql->real_escape_string(md5(uniqid(rand())));
	
	$sql->query("INSERT INTO uploadingFiles (fileName, fileSize, hash, token) VALUES ('$fileName', $fileSize, '$hash', '$token')");
	
	$res = $sql->query("SELECT id FROM uploadingFiles WHERE token = '$token'");
	if($res->num_rows === 0)
		throw new Error("Creating uploader error");
		
	$fileId = $res->fetch_object()->id;
	$hFile = fopen(tmp_dir.$fileId, 'x');//создаем пустой файл
	if($hFile === false)
		throw new Exception("Temporary file creating error");
	
	fclose($hFile);
	
	return $token;
}




function killUploader($uploader, $sql){
	$sql->query("DELETE FROM uploaders WHERE token='".$uploader->token."'");
	unlink(tmp_dir.$uploader->id);
}

function uploadPart($token, $partSize, $filePart){	
	if(is_numeric($partSize) === false)
		throw new Exception("Incorrect part size");


	$sql = new mysqli(HOST, DBuser, DBpass, DBname);
	if(!$sql)
		throw new Exception("MySQL connection error");
	
	$sql->set_charset("utf8");
	
	$token = $sql->real_escape_string($token);
	$partSize = $sql->real_escape_string($partSize);
	
	
	$res = $sql->query("SELECT * FROM uploadingFiles WHERE token = '$token'");
	if($res->num_rows === 0)
		throw new Exception("Incorrect token");
	
	$uploader = $res->fetch_object();
	$srcFile = fopen($filePart["tmp_name"], 'r');
	$dstFile = fopen(tmp_dir.$uploader->id, 'a');
	
	if(($srcFile && $dstFile) === false)
		throw new Exception("File opening error");
	
	$contents = fread($srcFile, $partSize);
	
	if(fwrite($dstFile, $contents) !== intval($partSize)){
		killUploader($uploader, $sql);
		throw new Exception("fwrite incomplete");
	}
		
	$sql->query("UPDATE uploadingFiles SET uploaded = uploaded + $partSize WHERE token = '$token'");
}
	
	
	
function finishUpload($token){
	$sql = new mysqli(HOST, DBuser, DBpass, DBname);
	if(!$sql)
		throw new Exception("MySQL connection error");
		
	$token = $sql->real_escape_string($token);
	
	$res = $sql->query("SELECT * FROM uploadingFiles WHERE token = '$token'");
	if($res->num_rows === 0)
		throw new Exception("Invalid token");
	
	$uploader = $res->fetch_object();
	
	$hFile = fopen(tmp_dir.$uploader->id, "r");
	if($hFile === false)
		throw new Exception("File does not exist");
	
	
	if(intval($uploader->fileSize) !== filesize(tmp_dir.$uploader->id))
		throw new Exception("Upload is incomplete");
	
	$hash = hash_file("crc32b", tmp_dir.$uploader->id);
	if($uploader->hash !== $hash){
		killUploader($uploader, $sql);
		throw new Exception("CRC32 doesn't match: $hash !== ".$uploader->hash);
	}
	
	$res = rename(tmp_dir.$uploader->id, uploadedFilesDir.$uploader->id);
	if($res === false){
		killUploader($uploader, $sql);
		throw new Exception("Moving file error");
	}
	
	$sql->query("DELETE FROM uploadingFiles WHERE token = '".$uploader->token."'");
	
	
	$token = bin2hex(openssl_random_pseudo_bytes(tokenLength));
	$token = $sql->real_escape_string($token);
	
	$sql->query("INSERT INTO files (token, path, fileName) VALUES ('$token', '".uploadedFilesDir.$uploader->id."', '".$uploader->fileName."')");
	
	return $token;
}

	
?>	
	
