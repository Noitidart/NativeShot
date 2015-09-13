(function(cash) { "use strict";	
				 		 
	
    /***********************************/
	/*Swiper Slider*/
	/**********************************/
		
    var swipers = [];
    var winW = $(window).width();
    var winH  =  $(window).height();
	var xsPoint = 700, smPoint = 991, mdPoint = 1199; 
	var initIterator = 0;		 
    function swiperInit(){
		  $('.swiper-container').each(function(){								  
			var $th = $(this);								  
			var index = $th.attr('id'); 
				$(this).addClass('swiper-'+index + ' initialized').attr('init-attr', 'swiper-'+index);
				$(this).find('.pagination').addClass('pagination-'+index);
				var autoPlayVar = parseInt($th.attr('data-autoplay'),10);
				var slidesPerViewVar = $th.attr('data-slides-per-view');
			    var loopVar = parseInt($th.attr('data-loop'),10);
			    var mouseVar = parseInt($th.attr('data-mouse'),10);
			    var sliderSpeed = parseInt($th.attr('data-speed'),10);
			    var touchVar = parseInt($th.attr('data-touch'),10);
			    var xsValue, smValue, mdValue, lgValue;
			    var slideMode =  $th.attr('data-mode');
			    if(slidesPerViewVar == 'responsive'){
					 xsValue = parseInt($th.attr('data-xs-slides'),10);
					 smValue = parseInt($th.attr('data-sm-slides'),10);
					 mdValue = parseInt($th.attr('data-md-slides'),10);
					 lgValue = parseInt($th.attr('data-lg-slides'),10);
					 slidesPerViewVar = updateSlidesPerView(xsValue, smValue, mdValue, lgValue);
                } else slidesPerViewVar = parseInt(slidesPerViewVar);
				swipers ['swiper-'+index] = new Swiper('.swiper-'+index,{
					speed: sliderSpeed,
					loop: loopVar,
					mode: slideMode,
					grabCursor: true,
					pagination: '.pagination-'+index,
					paginationClickable: true,
					autoplay: autoPlayVar,
					autoplayDisableOnInteraction: true,
					slidesPerView: slidesPerViewVar,
					keyboardControl: true,
					simulateTouch: touchVar,
					calculateHeight: true,
					mousewheelControl: mouseVar
				});
			swipers['swiper-'+index].reInit();
		    initIterator++;
		});
	 }			 
	 $('.slide-prev').on('click', function(){
     var arIndex = $(this).parent().find('.swiper-container').attr('init-attr');
      swipers[arIndex].swipePrev();
     });
     $('.slide-next').on('click', function(){
     var arIndex = $(this).parent().find('.swiper-container').attr('init-attr');
      swipers[arIndex].swipeNext();
     });		 			 	 
	function updateSlidesPerView(xsValue, smValue, mdValue, lgValue){
         if(winW > mdPoint) return lgValue;
         else if(winW>smPoint) return mdValue;
         else if(winW>xsPoint) return smValue;
         else return xsValue;
    }			 				 			   
    swiperInit();
				 
	/***********************************/
	/*TABS FAQ*/
	/**********************************/			 
				 
	var tabFinish = 0;
	$('.nav-tab-item').on('click',  function(){
	    var $t = $(this);
	    if(tabFinish || $t.hasClass('active')) return false;
	    tabFinish = 1;
	    $t.closest('.nav-tab').find('.nav-tab-item').removeClass('active');
	    $t.addClass('active');
	    var index = $t.parent().parent().find('.nav-tab-item').index(this);
	    $t.closest('.tab-wrapper').find('.tab-info:visible').fadeOut(500, function(){
	        $t.closest('.tab-wrapper').find('.tab-info').eq(index).fadeIn(500, function() {
	            tabFinish = 0;
	        });
	    });
	});
				 
				 
	/***********************************/
	/*MAGNIFIC POPUP*/
	/**********************************/			 

	$('.popup-gallery').magnificPopup({
		delegate: 'a',
		type: 'image',
		tLoading: '',
		mainClass: 'mfp-with-zoom',
		removalDelay: 500,
		gallery: {
			enabled: true,
			navigateByImgClick: true
		},
		zoom: {
			enabled: true,
			duration: 300,
			easing: 'ease-in-out', 
			opener: function(openerElement) {
			  return openerElement.is('img') ? openerElement : openerElement.find('img');
			}
		},
		callbacks: {
			imageLoadComplete: function() {
			  var self = this;
			  setTimeout(function() {
				self.wrap.addClass('mfp-image-loaded');
			  }, 16);
			},
			close: function() {
			  this.wrap.removeClass('mfp-image-loaded');
			},
			beforeChange: function() {
     this.items[0].src = this.items[0].src + '?=' + Math.random(); 
            }
		},
		 closeBtnInside: false,
         closeOnContentClick: true,
         midClick: true
	});				 
				 
	/***********************************/
	/*MOBILE MENU*/
	/**********************************/
						 
	$('.nav-menu-icon a').on('click', function() { 
	  if ($('nav').hasClass('slide-menu')){
		  $('nav').removeClass('slide-menu'); 
		  $(this).removeClass('active');
	  }else {
		   $('nav').addClass('slide-menu');
		  $(this).addClass('active');
	  }
		return false;
	 });
				 
	if ($(window).width()<992){			 
		$('.menu > ul > li > a').on('click', function(){
		   if ($(this).parent().find('.dropmenu').hasClass('slidemenu')) {
			   $(this).parent().find('.dropmenu').removeClass('slidemenu');
		   }else{
			   $('.menu > ul > li > a').parent().find('.dropmenu').removeClass('slidemenu');
			   $(this).parent().find('.dropmenu').addClass('slidemenu');
		   }
			return false;
		});
		
		$('.submenu').on('click', function(){
			if($(this).parent().find('ul').hasClass('slidemenu')){
			    $(this).parent().find('ul').removeClass('slidemenu');
			}else{
			   $('.submenu').parent().find('ul').removeClass('slidemenu'); 
			   $(this).parent().find('ul').addClass('slidemenu');
			}
			return false;
		});
	}			 
				
    /***********************************/
	/*ANIMSITION PLUGIN FOR PAGE TRANSITION*/
	/**********************************/
				 
	if($(".animsition").length){
	   $(".animsition").animsition({
		inClass               :   'fade-in-up-sm',
		outClass              :   'fade-out-up-sm',
		inDuration            :    1100,
		outDuration           :    800,
		linkElement           :   '.animsition-link',
		loading               :    true,
		loadingParentElement  :   'body', 
		loadingClass          :   'animsition-loading',
		unSupportCss          : [ 'animation-duration',
								  '-webkit-animation-duration',
								  '-o-animation-duration'
								],
		overlay               :   false,
		overlayClass          :   'animsition-overlay-slie',
		overlayParentElement  :   'body'
	  });
	}
				 
	/***********************************/
	/*DROPDOWN LIST*/
	/**********************************/			 
				 
	$('.drop').on( "click", function() {
			if($('.drop-list').hasClass('act')){
				$(this).find('.drop-list').removeClass('act');
				$(this).find('span').slideUp(300);
			}else{
               $('.drop span').slideUp(300);
				$(this).find('.drop-list').addClass('act');
				$(this).find('span').slideDown(300);
			}
			return false;
		});
		
    $('.drop span button, .drop span a').on( "click", function() {
			$(this).parent().parent().find('b').text($(this).text());
			$('.drop').find('span').slideUp(300);
		});	
				 
	/***********************************/
	/*BOOTSTRAP SLIDER*/
	/**********************************/
				 
	if($('.h-slider').length){			 
	$('.h-slider').slider({
		range: true,
		values: [50, 67]
	});
	}			 
	var tpl_tab_height;
        $(".tpl-minimal-tabs > li > a").click(function(){
        
            if (!($(this).parent("li").hasClass("active"))) {
                tpl_tab_height = $(".tpl-minimal-tabs-cont > .tab-pane").filter($(this).attr("href")).height();
                $(".tpl-minimal-tabs-cont").animate({
                    height: tpl_tab_height
                }, function(){
                    $(".tpl-minimal-tabs-cont").css("height", "auto");
                }); 
            } 
    });			 
				 
	/***********************************/
	/*ACCORDIONS*/
	/**********************************/			 
				 
	 var allPanels = $(".accordion > dd").hide();
        allPanels.first().slideDown("easeOutExpo");
        $(".accordion > dt > a").first().addClass("active");
        $(".accordion > dt > a").click(function(){
            var current = $(this).parent().next("dd");
            $(".accordion > dt > a").removeClass("active");
            $(this).addClass("active");
            allPanels.not(current).slideUp("easeInExpo");
            $(this).parent().next().slideDown("easeOutExpo");
            return false;
     });			 
	 var allToggles = $(".toggle > dd").hide();
        $(".toggle > dt > a").click(function(){
            if ($(this).hasClass("active")) {
                $(this).parent().next().slideUp("easeOutExpo");
                $(this).removeClass("active");  
            }
            else {
                var current = $(this).parent().next("dd");
                $(this).addClass("active");
                $(this).parent().next().slideDown("easeOutExpo");
            }
            return false;
    });			 			 
			 
	/***********************************/
	/*SLIP HOVER PLUGIN*/
	/**********************************/
				 
	if ($(window).width()>992){			 
	if ($('.sliphover').length){			 
		 $('.sliphover').sliphover({
			 target: '.ellem',
			 caption: 'data-caption',
			 fontColor: '#fff'
		 });
	}
	}
				 
	/***********************************/
	/*GOOGLE MAP*/
	/**********************************/
				 		 
	function initialize(obj) {
		var stylesArray = {
		'style-1' : {
    		'style': [{"featureType":"landscape","stylers":[{"saturation":-100},{"lightness":65},{"visibility":"on"}]},{"featureType":"poi","stylers":[{"saturation":-100},{"lightness":51},{"visibility":"simplified"}]},{"featureType":"road.highway","stylers":[{"saturation":-100},{"visibility":"simplified"}]},{"featureType":"road.arterial","stylers":[{"saturation":-100},{"lightness":30},{"visibility":"on"}]},{"featureType":"road.local","stylers":[{"saturation":-100},{"lightness":40},{"visibility":"on"}]},{"featureType":"transit","stylers":[{"saturation":-100},{"visibility":"simplified"}]},{"featureType":"administrative.province","stylers":[{"visibility":"off"}]},{"featureType":"water","elementType":"labels","stylers":[{"visibility":"on"},{"lightness":-25},{"saturation":-100}]},{"featureType":"water","elementType":"geometry","stylers":[{"hue":"#ffff00"},{"lightness":-25},{"saturation":-97}]}]
		}		
		}

		var lat = $('#'+obj).attr("data-lat");
        var lng = $('#'+obj).attr("data-lng");
		var contentString = $('#'+obj).attr("data-string");
		var myLatlng = new google.maps.LatLng(lat,lng);
		var map, marker, infowindow;
		var image = 'chrome://nativeshot/content/app/img/marker.png';
		var zoomLevel = parseInt($('#'+obj).attr("data-zoom"),10);
		var styles = stylesArray[$('#map-canvas-contact').attr("data-style")]['style'];
		var styledMap = new google.maps.StyledMapType(styles,{name: "Styled Map"});
	    
		var mapOptions = {
			zoom: zoomLevel,
			disableDefaultUI: true,
			center: myLatlng,
            scrollwheel: false,
			mapTypeControlOptions: {
            mapTypeIds: [google.maps.MapTypeId.ROADMAP, 'map_style']
			}
		}
		
		map = new google.maps.Map(document.getElementById(obj), mapOptions);
	
		map.mapTypes.set('map_style', styledMap);
		map.setMapTypeId('map_style');
	
		infowindow = new google.maps.InfoWindow({
			content: contentString
		});
      
	    
        marker = new google.maps.Marker({
			position: myLatlng,
			map: map,
			icon: image
		});
	
		google.maps.event.addListener(marker, 'click', function() {
			infowindow.open(map,marker);
		});
	
	}			 
				  		 
	/***********************************/
	/*WINDOW SCROLL*/
	/**********************************/			 
	
	$(window).scroll(function() {
	   if ($('.time-line').length) {
		 $('.time-line').not('.animated').each(function(){
		  if($(window).scrollTop() >= $(this).offset().top-$(window).height()*0.5)
		   {$(this).addClass('animated').find('.timer').countTo();}});
		}
		if ($('.start-line').length){
			if($(window).scrollTop() >= $('.start-line').offset().top - $('.start-line').height()){
				 $('.skill-line div').each(function(){
							var objel = $(this);
							var pb_width = objel.attr('data-width-pb');
							objel.css({'width':pb_width});
						});
			  }
		 }
		if ($(window).scrollTop() >= 10){
			$('header').addClass('fix');  
		}else {
			$('header').removeClass('fix');
		}
		
		if ($(window).scrollTop() >= 10){
			$('.scroll-head').addClass('fix');  
		}else {
			$('.scroll-head').removeClass('fix');
		}
	});
				 
				 
	if ($('.onepage').length){			 			 
		smoothScroll.init({
			speed: 800
		});			 
	}
	
			 
	$('.onepage nav a').on('click', function(){
		   $('.onepage nav a').removeClass('active');
		   $('.nav-menu-icon a').removeClass('active');
		   $(this).addClass('active');
		   $('.onepage nav').removeClass('slide-menu');
	});
	
				 
	/***********************************/
	/*WINDOW RESIZE*/
	/**********************************/
				 
	function resizeCall() {
		winW = $(window).width();
   		winH = $(window).height();
         $('.swiper-container[data-slides-per-view="responsive"]').each(function(){
			 var $th = $(this);
			 var xsValue = parseInt($th.attr('data-xs-slides'),10);
			 var smValue = parseInt($th.attr('data-sm-slides'),10);
			 var mdValue = parseInt($th.attr('data-md-slides'),10);
			 var lgValue = parseInt($th.attr('data-lg-slides'),10);
			 var currentSwiper = swipers[$(this).attr('init-attr')];
			 var newSlideNumber = updateSlidesPerView(xsValue, smValue, mdValue, lgValue);
			 currentSwiper.params.slidesPerView = newSlideNumber;
             currentSwiper.reInit();
         });
	}
    $(window).resize(function(){
         resizeCall();
    });				 
	window.addEventListener("orientationchange", function() {
         resizeCall();
    }, false);	
				  
	/***********************************/
	/*WINDOW LOAD*/
	/**********************************/
 
    $(window).load(function() {
		if($('#map-canvas-contact').length==1){
		   initialize('map-canvas-contact');}
		
	    if ($('.izotope-container').length) { 
			 var $container = $('.izotope-container');
              $container.isotope({
                itemSelector: '.item',
                layoutMode: 'masonry',
                masonry: {
                  columnWidth: '.grid-sizer'
                }
              });
			  $('#filters').on('click', '.but', function() {
				$('.izotope-container').each(function(){
				   $(this).find('.item').removeClass('animated');
				});
				$('#filters .but').removeClass('activbut');
				  $(this).addClass('activbut');
					 var filterValue = $(this).attr('data-filter');
						$container.isotope({filter: filterValue});
						  });
           }
	 });
				 
	/***********************************/
	/*TEAM HOVER*/
	/**********************************/
		 			 
	 $('.team-block').mouseenter(function(){
	    $(this).find('.later-team').css({"left":"0"}); 
	 }).mouseleave(function(){
		$(this).find('.later-team').css({"left":"100%"});		   
     });
			
				 
})(jQuery); 