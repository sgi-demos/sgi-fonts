// Fork of https://web.archive.org/web/20220527005219/https://discourse.threejs.org/t/texfont-for-three-js/35888
// 
import * as THREE from './three.module.js'; // https://unpkg.com/browse/three@0.150.1/build/three.module.js
import { OrbitControls } from './OrbitControls.js'; // https://unpkg.com/browse/three@0.150.1/examples/jsm/controls/OrbitControls.js
import { Texfont } from './texfont.js';

let texture_ready = false;
let srcTexture;

let scene, camera, controls, renderer, srcMaterial;

let txf = new Texfont();
let fontName = 'Helvetica-Oblique';
// fontName = 'ZapfChancery-MediumItalic';
// fontName = 'curlfont';
// fontName = 'junius';
// fontName = 'derniere';
// fontName = 'sorority';

txf.LoadTexfont( 'txf/' + fontName + '.txf', txf );

renderer = new THREE.WebGLRenderer({antialias: true, alpha: true });
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.setPixelRatio( window.devicePixelRatio );
document.body.appendChild( renderer.domElement );

scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera( 80, window.innerWidth / window.innerHeight, 1, 2000 );
camera.position.set( 0, 0, 640  );

// Orbit
controls = new OrbitControls( camera, renderer.domElement );
controls.addEventListener( 'change', render );

// UV grid environment sphere
let texture = new THREE.TextureLoader().load( 'uv_grid_opengl.jpg' );
texture.mapping = THREE.EquirectangularReflectionMapping;
scene.background = texture;

// axes
scene.add( new THREE.AxesHelper( 80.0 ) );

window.addEventListener( 'resize', onWindowResize );

render();

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );
	
	render();

}

function render() {
	// instead of animation loop: update only on OrbitControl() 'change' events

	if(( txf.teximage.length != 0 ) && !texture_ready ) {

		// as soon as Texfont.teximage becomes available (as the result of an async! loading),
		// copy its contents into a data texture for use in the display of glyphs
		setupTexfontMaterial();

		let bitmapMesh = txf.ShowFontBitmap( txf );
		bitmapMesh.position.y += txf.tex_height;
		scene.add( bitmapMesh );


		// background rectangle
		var planeMesh = new THREE.Mesh( 
			new THREE.PlaneGeometry( txf.tex_width*4, txf.tex_height*4 ), 
			new THREE.MeshBasicMaterial( {color: 0x000000, side: THREE.DoubleSide} ) );
		planeMesh.position.z -= 1.0;
		scene.add( planeMesh );

		let stringGroup = txf.RenderString( txf, 'Silicon Graphics Computer Systems' );
		scene.add( stringGroup );

		texture_ready = true;
									
	} else {
		// automatically consume frames until texture is ready.
		// After that, update on OrbitControl() 'change' events only.
		if ( !texture_ready ) requestAnimationFrame( render );
			
	}

	renderer.render( scene, camera );
	
}

function setupTexfontMaterial() {
	
	var width = txf.tex_width;
	var height = txf.tex_height;
	var size = width * height;
	var srcData = new Uint8Array( 4 * size );	// THREE.RGBAFormat
					
	let i, j, jj, k;
	
	for(  i = 0; i < height; i++ ) {
		for ( j = 0; j < width; j++ ) {
			k = i * width + j;
			jj = 4 * k;
			srcData[ jj + 0 ] = txf.teximage[ k ];
			srcData[ jj + 1 ] = txf.teximage[ k ];
			srcData[ jj + 2 ] = txf.teximage[ k ];
			srcData[ jj + 3 ] = 255;		// 0: set pixels fully transparent; 255: fully colored
		}
	}

	srcTexture = new THREE.DataTexture( srcData, width, height, THREE.RGBAFormat );
	srcTexture.needsUpdate = true;

	srcMaterial = new THREE.MeshBasicMaterial( {
		side: THREE.DoubleSide,
		color: 0xffffff,
		blending: THREE.NoBlending,	
		map: srcTexture
	} );
	
	txf.srcMaterial = srcMaterial;

}