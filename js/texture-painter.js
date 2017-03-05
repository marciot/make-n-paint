var camera;
var scene;
var renderer;
var mesh;
var texture;
var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();
var controls;

function replaceSVGs() {
	console.log("Called replaceSVGs");
	/*
	* Replace all SVG images with inline SVG
	*
	*   http://stackoverflow.com/questions/11978995/how-to-change-color-of-svg-image-using-css-jquery-svg-image-replacement
	*/
	jQuery('img.svg').each(function(){
		var $img     = jQuery(this);
		var imgID    = $img.attr('id');
		var imgClass = $img.attr('class');
		var imgURL   = $img.attr('src');

		jQuery.get(imgURL, function(data) {
			// Get the SVG tag, ignore the rest
			var $svg = jQuery(data).find('svg');

			// Add replaced image's ID to the new SVG
			if(typeof imgID !== 'undefined') {
				$svg = $svg.attr('id', imgID);
			}
			// Add replaced image's classes to the new SVG
			if(typeof imgClass !== 'undefined') {
				$svg = $svg.attr('class', imgClass+' replaced-svg');
			}

			// Remove any invalid XML tags as per http://validator.w3.org
			$svg = $svg.removeAttr('xmlns:a');

			// Replace image with new SVG
			$img.replaceWith($svg);

		}, 'xml');

	});	
}

// Reference: https://gist.github.com/MAKIO135/eab7b74e85ed2be48eeb

// Bump map demo:
//
//   http://codepen.io/Mombasa/pen/ivdyC

class PaintableTexture {
	constructor(depthDom, colorDom, blendDom) {
		this.depthCanvas     = depthDom;
		this.colorCanvas     = colorDom;
		this.compositeCanvas = blendDom;
		this.depthTexture    = new THREE.Texture(depthDom);
		this.colorTexture    = new THREE.Texture(colorDom);
		this.textureWidth    = 512;
		this.textureHeight   = 512;
		this.tool            = "pencil";
		this.painting        = false;
		this.paintColor      = "black";
		this.clear();
		this.depthTexture.needsUpdate = true;
		this.colorTexture.needsUpdate = true;
		
		var ctx = this.compositeCanvas.getContext('2d');
		ctx.lineCap = "round";
	}
	
	clear() {
		var ctx = this.colorCanvas.getContext('2d');
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, this.textureWidth, this.textureHeight);
	}

	mouseMoveUV(uv) {
		var x =    uv.x  * this.textureWidth;
		var y = (1-uv.y) * this.textureHeight;
		this.mouseMoveXY(x,y);
	}
	
	mouseMoveXY(x, y) {
		if(Math.abs(x - this.lastX) > this.textureWidth/2) {
			// Check for jumping across the seam
			if(x > this.lastX) {
				this.lastX += this.textureWidth;
			} else {
				this.lastX -= this.textureWidth;
			}
		}
		if(this.painting) {
			var ctx = this.compositeCanvas.getContext('2d');
			
			if(this.tool == "pencil") {
				ctx.strokeStyle  = "white";
				ctx.lineWidth    = 4;
				ctx.beginPath();
				ctx.moveTo(this.lastX,this.lastY);
				ctx.lineTo(x,y);
				ctx.stroke();
			} else if(this.tool == "eraser") {
				var size = 30;
				ctx.clearRect(x-size/2,y-size/2,size,size);
			} else if(this.tool == "roller") {
				ctx.strokeStyle = this.rollerPattern;
				ctx.lineWidth  = 60;
				ctx.beginPath();
				ctx.moveTo(this.lastX,this.lastY);
				ctx.lineTo(x,y);
				ctx.stroke();
			}

			if(this.tool == "colorize") {
				ctx.globalCompositeOperation = "source-atop";
				ctx.strokeStyle = this.paintColor;
				ctx.lineWidth  = 60;
				ctx.beginPath();
				ctx.moveTo(this.lastX,this.lastY);
				ctx.lineTo(x,y);
				ctx.stroke();
				ctx.globalCompositeOperation = "source-over";
			}
			
			this.blend();
			this.depthTexture.needsUpdate = true;
			this.colorTexture.needsUpdate = true;
		}
		this.lastX = x;
		this.lastY = y;
	}
	
	blend() {
		var ctx = this.depthCanvas.getContext('2d');
		ctx.clearRect(0, 0, this.textureWidth, this.textureHeight);
		ctx.drawImage(this.compositeCanvas, 0, 0);
		ctx.globalCompositeOperation = "source-atop";
		ctx.fillStyle = "white";
		ctx.fillRect(0, 0, this.textureWidth, this.textureHeight);
		ctx.globalCompositeOperation = "source-over";
		
		var ctx = this.colorCanvas.getContext('2d');
		ctx.fillStyle = "white";
		ctx.fillRect(0, 0, this.textureWidth, this.textureHeight);
		ctx.drawImage(this.compositeCanvas, 0, 0);
	}
	
	mouseDown() {
		this.painting = true;
	}
	
	mouseUp() {
		this.painting = false;
	}
	
	getDepthTexture() {
		return this.depthTexture;
	}
	
	getColorTexture() {
		return this.colorTexture;
	}
	
	setTool(tool) {
		this.tool = tool;
	}
	
	setRollerPattern(img) {
		var ctx = this.depthCanvas.getContext('2d');
		this.rollerPattern = ctx.createPattern(img, 'repeat');
	}
	
	setPaintColor(color) {
		this.paintColor = color;
	}
}

function addPatternSwatch(url) {
	var swatch = $("<div></div>").css("background", "url(" + url + ")").click(
		function() {
			var img = new Image();
			img.src = url;
			img.onload = function() {
				texture.setRollerPattern(img);
			};
		}
	);
	$("#patterns").append(swatch);
}

function addColorSwatch(color) {
	var swatch = $("<div></div>").css("background", color).click(
		function() {
			texture.setPaintColor(color);
		}
	);
	$("#colors").append(swatch);
}

function getVaseGeometry() {
	var geometry = new THREE.Geometry();
	var fn           = 15;
	var vase_height  = 100;
	var zOffset      = vase_height/2;
	var vertexUV     = [];
	
	function contour(z) {
		return 20 + Math.sin(z/vase_height*2*Math.PI) * 2 - 5 * (z/vase_height);
	}
	function pushOrigin() {
		vertexUV.push(new THREE.Vector2(0.5,0));
		return geometry.vertices.push(new THREE.Vector3(0,-zOffset,0))-1;
	}
	function pushPointOnSurf(a,z) {
		vertexUV.push(new THREE.Vector2(1-a/(Math.PI*2), z/vase_height*0.9+0.1));
		return geometry.vertices.push(new THREE.Vector3(contour(z) * Math.cos(a), z-zOffset, contour(z) * Math.sin(a)))-1;
	}
	var z = 0;
	var zStep = 3;
	var aStep = 2.0*Math.PI/fn;	
	var v0 = pushOrigin();
	for( var a = 0; a < 2*Math.PI; a += aStep ) {
		var v1 = pushPointOnSurf(a,z);
		var v2 = pushPointOnSurf(a+aStep,z);
		geometry.faces.push(new THREE.Face3(v0,v1,v2));
		geometry.faceVertexUvs[0].push([vertexUV[v0],vertexUV[v1],vertexUV[v2]]);
	}
	for(;z < vase_height; z += zStep) {
		for(var a = 0; a < 2*Math.PI - aStep; a += aStep ) {
			var v1 = pushPointOnSurf(a+aStep,z      );
			var v2 = pushPointOnSurf(a+aStep,z+zStep);
			var v3 = pushPointOnSurf(a,      z+zStep);
			var v4 = pushPointOnSurf(a,      z      );
			geometry.faces.push(new THREE.Face3(v1,v2,v3));
			geometry.faces.push(new THREE.Face3(v3,v4,v1));
			geometry.faceVertexUvs[0].push([vertexUV[v1],vertexUV[v2],vertexUV[v3]]);
			geometry.faceVertexUvs[0].push([vertexUV[v3],vertexUV[v4],vertexUV[v1]]);
		}
	}
	geometry.computeFaceNormals();
	geometry.computeVertexNormals();
	return geometry;
}

function showToolOptions(tool) {
	$("#patterns").toggle(tool == "roller");
	$("#colors").toggle(tool == "colorize");
}

function initTools() {
	replaceSVGs();
	$("#tools div").click(function() {
		$("#tools div").removeClass("selected");
		$(this).addClass("selected");
		var tool = $(this).attr('id');
		texture.setTool($(this).attr('id'));
		showToolOptions(tool);
	});
	$("#toggleTexture").click(function() {
		$(this).toggleClass("selected");
		$("#blendCanvas").toggle();
	});
	$("#toggleAbout").click(function() {
		$(this).toggleClass("selected");
		$("#about").toggle();
	});
	$("#sharing").click(function() {
		$(this).toggleClass("selected");
		$("#sharingMenu").toggle();
	});
	/*$("#photo").click(function() {
		sendToSlicer();
	});*/
	
	addPatternSwatch("images/dots.png");
	addPatternSwatch("images/zigzag.png");
	addPatternSwatch("images/scroll.png");
	
	addColorSwatch("darkgreen");
	addColorSwatch("red");
	addColorSwatch("blue");
	addColorSwatch("black");
	addColorSwatch("yellow");
	addColorSwatch("purple");
}

function init() {
  	/* A tutorial on how to properly handling sizing for a THREE.js
  	 * that renders INSIDE a canvas element (rather than the window)
  	 * is here:
  	 *
  	 *    http://www.rioki.org/2015/04/19/threejs-resize-and-canvas.html
  	 *
  	 */
	 
	var canvas = document.getElementById("renderCanvas");

    scene  = new THREE.Scene();
    camera = new THREE.PerspectiveCamera( 45, canvas.clientWidth / canvas.clientHeight, 1, 1000);
  	camera.position.z = -150;
  	
  	/* A light source affixed to the camera:
  	     Reference: http://stackoverflow.com/questions/24318241/rotating-light-source-with-camera-orbitcontrols-js
  	 */    
    var light = new THREE.PointLight( new THREE.Color("rgb(255,255,255)"), 0.50);
    light.position.set(0,200,0);
    camera.add(light);
    
    //var light = new THREE.DirectionalLight( new THREE.Color("rgb(128,128,128)"), 0.5);
    //light.position.set( 0, 1, -1 ).normalize();
    //camera.add(light);
    
    scene.add(camera);
    
    /* Ambient light source to soften the shadows */
    var light = new THREE.AmbientLight("rgb(128,128,128)");
    scene.add(light);
  
    geometry = getVaseGeometry();
    //var material = new THREE.MeshPhongMaterial( { ambient: 0x050505, color: 0x0033ff, specular: 0x555555, shininess: 30 } );
    
	texture = new PaintableTexture(
		document.getElementById("depthCanvas"),
		document.getElementById("colorCanvas"),
		document.getElementById("blendCanvas")
	);
	
    this.material = new THREE.MeshPhongMaterial({
		color      :  new THREE.Color("rgb(155,196,30)"),
		//emissive   :  new THREE.Color("rgb(7,3,5)"),
		specular   :  new THREE.Color("rgb(255,113,0)"),
		shininess  :  20,
		map        :  texture.getColorTexture(),
		bumpMap    :  texture.getDepthTexture(),
		bumpScale  :  1,
		side       :  THREE.DoubleSide,
		shading    :  THREE.SmoothShading
	});
  
    mesh = new THREE.Mesh(geometry, this.material);
    scene.add( mesh );
  
	/* Setting alpha to true allows the canvas to be styled with CSS */
    renderer = new THREE.WebGLRenderer({alpha: true, canvas: canvas, preserveDrawingBuffer: true});
    canvas.width  = canvas.clientWidth;
	canvas.height = canvas.clientHeight;
	renderer.setViewport(0, 0, canvas.clientWidth, canvas.clientHeight);
	
    window.addEventListener( 'resize', onWindowResize, false );
    
    // Add the controls
    controls = new THREE.OrbitControls(camera, canvas);
	
	initMouseCursor(canvas);
	initTools();
  
    render();
	
	setTheme("grayTheme");
}

function setTheme(theme) {
	if(theme == "greenTheme") {
		this.material.color    = new THREE.Color("rgb(155,196,30)");
		this.material.specular = new THREE.Color("rgb(255,113,0)");
	} else if(theme == "grayTheme") {
		this.material.color    = new THREE.Color("rgb(225,225,196)");
		this.material.specular = new THREE.Color("rgb(255,113,0)");
	}
}

function onWindowResize() {
	/* The resizing code here also comes from rioki */
	var canvas = document.getElementById('renderCanvas');
	canvas.width  = canvas.clientWidth;
  	canvas.height = canvas.clientHeight;
  	renderer.setViewport(0, 0, canvas.clientWidth, canvas.clientHeight);
  	camera.aspect = canvas.clientWidth / canvas.clientHeight;
  	camera.updateProjectionMatrix();
    render();
}
  
function animate() {
    //mesh.rotation.x += .0004;
    //mesh.rotation.y += .0002;
  
    render();
    requestAnimationFrame( animate );
}
  
function render() {
    renderer.render( scene, camera );
}

function capturePhoto() {
	renderer.render( scene, camera );
	imgData = renderer.domElement.toDataURL("jpeg");
	document.location.href = imgData;
}

function sendToSlicer() {
	var domain = location.origin + "/webslicer/slicer_demo.html";
	var myPopup = window.open(domain, 'slicerWindow');
	var json = geometryToJSON(geometry);
	window.setTimeout(function() {console.log("Sending message"); myPopup.postMessage({'cmd': 'loadGeometry', 'data': json.data}, location.origin, json.tranferables)},5000);
}

function getCursorPosition(canvas, event) {
	// http://stackoverflow.com/questions/55677/how-do-i-get-the-coordinates-of-a-mouse-click-on-a-canvas-element
    var rect = canvas.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    
	// calculate mouse position in normalized device coordinates
	// (-1 to +1) for both components
    return {
    	canvas     : {x: x, y: y},
    	normalized : {
    		x :    ( x / rect.width )  * 2 - 1,
			y :  - ( y / rect.height ) * 2 + 1
		}
	};
}

function initMouseCursor(dom) {
	var currentCursor = 0;
	var overObject = false;
	var grabbing   = false;
	
	function setCursor(cursor) {
		if(cursor != currentCursor) {
			var canvas    = document.getElementById("renderCanvas");
			currentCursor = cursor;
			switch(cursor) {
				case "grab":
					dom.style.cursor = "url(images/grab.gif), move";
					break;
				case "grabbing":
					dom.style.cursor = "url(images/grabbing.gif), move";
					break;
				case "crosshairs":
					canvas.style.cursor = "crosshair";
					break;
			}
		}
	}
	
	function updateCursor() {
		if(overObject) {
			setCursor("crosshairs");
		} else if(grabbing) {
			setCursor("grabbing");
		} else if(!grabbing) {
			setCursor("grab");
		}
	}
	
	function onMouseDown( event ) {
		if(!overObject && !grabbing) {
			grabbing = true;
		}
		texture.mouseDown();
	}

	function onMouseUp( event ) {
		if(!overObject && grabbing) {
			grabbing = false;
		}
		texture.mouseUp();
	}

	function onMouseMove( event ) {
		var canvas    = document.getElementById("renderCanvas");
		var pos = getCursorPosition(canvas, event);
		mouse.x = pos.normalized.x;
		mouse.y = pos.normalized.y;
		
		if(grabbing) return;
		
		raycaster.setFromCamera( mouse, camera );	

		// calculate objects intersecting the picking ray
		var intersects = raycaster.intersectObjects( scene.children );

		if(intersects.length) {
			for ( var i = 0; i < intersects.length; i++ ) {
				var object = intersects[ i ].object;
				texture.mouseMoveUV(intersects[ i ].uv);
				break;
			}
			overObject = true;
		} else {
			overObject = false;
		}
		controls.enabled = !overObject;
		updateCursor();
	}
	
	dom.addEventListener( 'mousedown', onMouseDown, false );
	dom.addEventListener( 'mouseup',   onMouseUp,   false );
	dom.addEventListener( 'mousemove', onMouseMove, false );
}

init();
animate();