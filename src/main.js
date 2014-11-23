/*
 * Universidade Federal da Bahia
 * Disciplina: Computação Gráfica - MATA65
 * Prof. Apolinário 
 * Semestre: 2014.2
 * 
 * Trabalho Prático 1
 * 
 * Autores: Nilton Vasques Carvalho e Jean Francescoli
 *
*/

var gl;
var shaderBaseImage	= null;
var shaderAxis		= null;
var shaderPlanets   	= null;
var axis 		= null;
var baseTexture		= null;
var model		= new Array;
var color 		= new Float32Array(3);
var modelMat 		= new Matrix4();
var ViewMat 		= new Matrix4();
var ProjMat 		= new Matrix4();
var MVPMat 		= new Matrix4();
var cameraPos 		= new Vector3();
var cameraLook 		= new Vector3();
var cameraUp 		= new Vector3();
var g_objDoc 		= null;	// The information of OBJ file
var g_drawingInfo 	= null;	// The information for drawing 3D model

// A biblioteca Aruco detecta os markers e atribui um id único de acordo
// com o desenho do marker.
// Aqui ficará declarado todos os marcadores que iremos utilizar na aplicação.
//
var SolMarker 		= new Object();
SolMarker.id		= 24;
SolMarker.rotMat 		= new Matrix4( );
SolMarker.transMat 	= new Matrix4( );
SolMarker.scaleMat 	= new Matrix4( );

var video, 
	videoImage, 
	videoImageContext, 
	videoTexture;

var imageData, 
	detector, 
	posit;

var modelSize 	= 90.0; //millimeters

var rotMat 	= new Matrix4();
var transMat 	= new Matrix4();
var scaleMat 	= new Matrix4();


var yaw 		= 0.0,
	pitch 		= 0.0,
	roll		= 0.0;

function main() {
	// Initializing Camera 	
	startCamera( );

	// Load html elements
	getHtmlElements( );

	gl = initGL(canvas);
		
	if (!gl) { 
		alert("Could not initialise WebGL, sorry :-(");
		return;
	}

	initializeShaderBaseImagem( );
		
	baseTexture = initBaseImage();
	if (!baseTexture) {
		console.log('Failed to set the baseTexture vertex information');
		return;
	}
	initTexture();

	initializeShaderAxis( );
			
	initializeShaderPlanets( );	

	// Loadin resources, fica aguardando o carregamento dos materiais e objetos
	// Após o carregamento é dado início a renderização através do mainloop animate/render.
	loadingResources( );
	
}

/*
 * Main loop do programa
 * Responsável por requisitar um novo frame a todo instante
 */
function animate() {
	requestAnimationFrame(animate);
	render();		
}

// ********************************************************
// ********************************************************
function render() {	
	
	if ( video.readyState === video.HAVE_ENOUGH_DATA ) {
		videoImageContext.drawImage( video, 0, 0, videoImage.width, videoImage.height );
		videoTexture.needsUpdate = true;
		imageData = videoImageContext.getImageData(0, 0, videoImage.width, videoImage.height);
		var markers = detector.detect(imageData);
	
		drawCorners(markers);
		
		drawScene(markers);

	}
}

function drawCorners(markers){

	var corners, corner, i, j;

	videoImageContext.lineWidth = 3;

	for (i = 0; i < markers.length; ++ i){
		corners = markers[i].corners;

		videoImageContext.strokeStyle = "red";
		videoImageContext.beginPath();

		for (j = 0; j < corners.length; ++ j){
			corner = corners[j];
			videoImageContext.moveTo(corner.x, corner.y);
			corner = corners[(j + 1) % corners.length];
			videoImageContext.lineTo(corner.x, corner.y);
		}

		videoImageContext.stroke();
		videoImageContext.closePath();

		videoImageContext.strokeStyle = "green";
		videoImageContext.strokeRect(corners[0].x - 2, corners[0].y - 2, 4, 4);
	}
};


// ********************************************************
// ********************************************************
function updateScenes(markers){ //As modificações foram feitas aqui!!
	var corners, corner, pose, i;

	for(var m = 0; m < markers.length; m++ ){

		corners = markers[m].corners;
		
		for (i = 0; i < corners.length; ++ i) {
			corner = corners[i];
			corner.x = corner.x - (canvas.width / 2);
			corner.y = (canvas.height / 2) - corner.y;
		}
		
		pose = posit.pose(corners);
					
		updateSolMarker( markers[m].id, pose );
	}
 
// Escolher se os modelos serão exibidos na posição anterior caso nenhum marcador seja encontrado 
	if( markers.length == 0 ){
		SolMarker.found = false;
	}
};

function updateSolMarker( markerId, pose ){
		if( markerId != SolMarker.id ){
			SolMarker.found = false;
			SolMarker.transMat.setIdentity();
			SolMarker.rotMat.setIdentity();
			SolMarker.scaleMat.setIdentity();
			return;
		}

		yaw 	= Math.atan2(pose.bestRotation[0][2], pose.bestRotation[2][2]) * 180.0/Math.PI;
		pitch 	= -Math.asin(-pose.bestRotation[1][2]) * 180.0/Math.PI;
		roll 	= Math.atan2(pose.bestRotation[1][0], pose.bestRotation[1][1]) * 180.0/Math.PI;

		SolMarker.found = true;

		SolMarker.rotMat.setIdentity();
		SolMarker.rotMat.rotate(yaw, 0.0, 1.0, 0.0);
		SolMarker.rotMat.rotate(pitch, 1.0, 0.0, 0.0);
		SolMarker.rotMat.rotate(roll, 0.0, 0.0, 1.0);

		SolMarker.transMat.setIdentity();
		SolMarker.transMat.translate(pose.bestTranslation[0], pose.bestTranslation[1], -pose.bestTranslation[2]);

		SolMarker.scaleMat.setIdentity();
		SolMarker.scaleMat.scale( modelSize, modelSize, modelSize );

		/*console.log(yaw);
		console.log(pitch);
		console.log(roll);
		*/

		/*console.log("pose.bestTranslation.x = " + pose.bestTranslation[0]/262.144);
		console.log("pose.bestTranslation.y = " + pose.bestTranslation[1]/262.144);
		console.log("pose.bestTranslation.z = " + -pose.bestTranslation[2]/262.144);
	*/
}

function drawScene(markers) {
	gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
	gl.clear(gl.COLOR_BUFFER_BIT);
	
	if (!videoTexture.needsUpdate) 
		return;
	
	modelMat.setIdentity();
	ViewMat.setIdentity();
	ProjMat.setIdentity();
	ProjMat.setOrtho(-1.0, 1.0, -1.0, 1.0, -1.0, 1.0);
	
	MVPMat.setIdentity();
	MVPMat.multiply(ProjMat);
	MVPMat.multiply(ViewMat);
	MVPMat.multiply(modelMat);
		
	drawTextQuad(baseTexture, shaderBaseImage, MVPMat);

// Verifica os marcadores encontrados
// Atualiza as matrizes de localização, translação e rotação dos objetos encontrados	
	updateScenes(markers);
   		
	ViewMat.setLookAt(	0.0, 0.0, 0.0,
    					0.0, 0.0, -1.0,
    					0.0, 1.0, 0.0 );
    
	ProjMat.setPerspective(40.0, gl.viewportWidth / gl.viewportHeight, 0.1, 1000.0);

// Desenha o sol caso seu marcador tenha sido encontrado
// IF SolMarker.found = true
	drawSol( true );

}

function loadingResources( ){
	readOBJFile("sphere.obj", gl, 1, true);

	var tick = function() {   // Start drawing
		if (g_objDoc != null && g_objDoc.isMTLComplete()) { // OBJ and all MTLs are available
			
			onReadComplete(gl);
			
			g_objDoc = null;
			
			configureCameraPosition( );	
		}
		if (model.length > 0) {
			animate();
			rotMat.setIdentity();
			transMat.setIdentity();
			animate();
		}else{
			detector 	= new AR.Detector();
			posit 		= new POS.Posit(modelSize, canvas.width);
			requestAnimationFrame(tick, canvas);
		}
	};	
	tick();
}

function configureCameraPosition( ){
	cameraPos.elements[0] 	= 0.8;
	cameraPos.elements[1] 	= 0.8;
	cameraPos.elements[2] 	= 0.8;
	cameraLook.elements[0] 	= 0.0;
	cameraLook.elements[1] 	= 0.0;
	cameraLook.elements[2] 	= 0.0;
	cameraUp.elements[0] 	= 0.0;
	cameraUp.elements[1] 	= 1.0;
	cameraUp.elements[2] 	= 0.0;
}

function drawSol( axisEnabled ){
		if( !SolMarker.found ) return;

		ViewMat.setLookAt(	0.0, 0.0, 0.0,
						0.0, 0.0, -1.0,
						0.0, 1.0, 0.0 );
	    
		ProjMat.setPerspective(40.0, gl.viewportWidth / gl.viewportHeight, 0.1, 1000.0);

		modelMat.setIdentity();
		modelMat.multiply(SolMarker.transMat);
		modelMat.multiply(SolMarker.rotMat);
		modelMat.multiply(SolMarker.scaleMat);

		MVPMat.setIdentity();
		MVPMat.multiply(ProjMat);
		MVPMat.multiply(ViewMat);
		MVPMat.multiply(modelMat);	
		
		if( axisEnabled ) drawAxis(axis, shaderAxis, MVPMat);

		try { 
			gl.useProgram(shaderPlanets);
		}catch(err){
			alert(err);
			console.error(err.description);
		}
		
		gl.uniformMatrix4fv(shaderPlanets.uModelMat, false, MVPMat.elements);
	
		color[0] = 1.0; color[1] = 1.0; color[2] = 0.0;
		gl.uniform3fv(shaderPlanets.uColor, color);
	

		for(var o = 0; o < model.length; o++) { 
			console.log("chegou aqui!!");
			draw(model[o], shaderPlanets, gl.TRIANGLES);
		}
}
