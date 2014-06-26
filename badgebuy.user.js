// ==UserScript==
// @name			Steam Trading Cards Bulk Buyer
// @namespace		http://www.doctormckay.com/
// @version			3.1.3
// @description		Provides a button to purchase remaining cards needed for a badge in bulk
// @match			http://steamcommunity.com/*/gamecards/*
// @require			http://ajax.googleapis.com/ajax/libs/jquery/2.0.3/jquery.min.js
// @copyright		2013 - 2014 Dr. McKay
// ==/UserScript==

$.ajaxSetup({
	xhrFields: {
		withCredentials: true
	}
});

//craft a badge if it is available
var elements = $('div.badge_craft_button');
var n = elements.length;
if(n > 0){
    for (var i = 0; i < n; i++) {
        var e = elements[i];
        
        e.click();
    }  
}

var links = $('.gamecards_inventorylink');
var cards = [];
var appid = 0;
var failures = [];

// Current currency (numerical identifier used by Steam)
var g_Currency = 1;
// Detailed information for each currency ID (using information taken from Steam's Javascript source code)
var g_CurrencyInfo =
{
    1: { symbol: "$", separator: "." },
    2: { symbol: "£", separator: "." },
    3: { symbol: "€", separator: "," },
    5: { symbol: "RUB", separator: "," }, // No unicode support for the new symbol yet
    7: { symbol: "R$", separator: "," }
}
// Function to format the string using the currency information
function formatPrice(price, full)
{
    if(full)
	{
		return g_CurrencyInfo[g_Currency].symbol + price.replace(".", g_CurrencyInfo[g_Currency].separator);
	}
	return price.replace(".", g_CurrencyInfo[g_Currency].separator);
}

var items = $('.unowned a'); // Enhanced Steam turns unowned into links
if(items.length == 0) {
	items = $('.unowned .badge_card_set_text');
	for(var i = 1; i < items.length; i++) {
		items.splice(i, 1); // Remove every other one since it's a series number
	}
}

if(links && $('.unowned').length > 0) {
	//links.append('<button type="button" class="btn_grey_grey btn_small_thin" id="buycards"><span>Buy remaining cards from Market</span></button');
    
    $('.gamecards_inventorylink').append('<div id="buycardspanel" style="visibility: hidden; margin-top: 5px"></div>');
    
    var parts = window.location.href.split('/');
		appid = parts[parts.length - 1];
		if(appid == '' || appid.indexOf('?border=') == 0) {
			appid = parts[parts.length - 2];
		}
		
		if(appid.indexOf('?') != -1) {
			appid = appid.substring(0, appid.indexOf('?'));
		}
		
		updatePrices();
    
    	$('#buycardspanel').css('display', 'none').css('visibility', 'visible').show('blind'); // We have to do this visibility/display thing in order for offsetWidth to work
    
	/*$('#buycards').click(function() {
		//$('#buycards').hide();
		$('.gamecards_inventorylink').append('<div id="buycardspanel" style="visibility: hidden; margin-top: 5px"></div>');
		
		var parts = window.location.href.split('/');
		appid = parts[parts.length - 1];
		if(appid == '' || appid.indexOf('?border=') == 0) {
			appid = parts[parts.length - 2];
		}
		
		if(appid.indexOf('?') != -1) {
			appid = appid.substring(0, appid.indexOf('?'));
		}
		
		updatePrices();
		
		$('#buycardspanel').css('display', 'none').css('visibility', 'visible').show('blind'); // We have to do this visibility/display thing in order for offsetWidth to work
	});*/
}

var g_CommodityStatus = -1; // -1 = unknown, 0 = not a commodity, 1 = is a commodity
var g_SessionID;
var num_cards_to_buy = 0;
var num_cards_bought = 0;

function updatePrices() {
	$('#buycardspanel').html('');
    
    g_CommodityStatus = -1;
	
	for(var i = 0; i < items.length; i++) {
		var name = getCardName(items[i]);
		$('#buycardspanel').append('<span class="cardname" style="padding-right: 10px; text-align: right; display: inline-block; font-weight: bold">' + name + '</span><span class="cardprice" data-name="' + name.replace(/"/g, '&quot;') + '">Loading...</span>' + '<br />');
		$.get('/market/listings/753/' + appid + '-' + encodeURIComponent(name + ((window.location.href.indexOf('?border=1') != -1) ? ' (Foil)' : '')), onCardPriceLoaded)
			.fail(function() {
				priceElement(name).html('Error');
			});
	}
	
	var elements = $('.cardname');
	var largestWidth = 0;
	for(var i = 1; i < elements.length; i++) {
		if(elements[i].offsetWidth > elements[largestWidth].offsetWidth) {
			largestWidth = i;
		}
	}
	
	$('.cardname').css('width', elements[largestWidth].offsetWidth + 'px');
}

function onCardPriceLoaded(data, textStatus) {
    num_cards_to_buy++;
	var html = $('<div></div>');
	html.append($(data));
	
	var title = html.find('title').text();
	var name = title.substring(title.indexOf('-') + 1);
	var hashName = title.substring(title.indexOf('Listings for ') + 13);
	
	if(data.indexOf('There are no listings for this item.') != -1 && name.indexOf('(Trading Card)') == -1 && name.indexOf('(Foil Trading Card)') == -1) {
		$.get('/market/listings/753/' + title.substring(title.indexOf('Listings for') + 13, title.indexOf('-')) + '-' + encodeURIComponent(name) + ' (' + ((window.location.href.indexOf('?border=1') != -1) ? 'Foil ' : '') + 'Trading Card)', onCardPriceLoaded)
			.fail(function() {
				priceElement(name).html('Error');
			});
		return;
	}
	
	name = name.replace(' (Trading Card)', '').replace(' (Foil Trading Card)', '').replace(' (Foil)', '');
	
    if(g_CommodityStatus == -1) {
        g_CommodityStatus = !!data.match(/Market_LoadOrderSpread\(\s?\d+\s?\);/);
		g_SessionID = data.match(/g_sessionID = ".+";/)[0];
		g_SessionID = g_SessionID.substring(15, g_SessionID.length - 2);
    }
	
	if(!g_CommodityStatus) {
		var item = findElementByClass(html, 'div', 'market_listing_row');
		var price = findElementByClass($(item), 'span', 'market_listing_price_with_fee');
		var pricenofee = findElementByClass($(item), 'span', 'market_listing_price_without_fee');
		
		if(textStatus != 'success' || !item || !price || !pricenofee) {
			priceElement(name).html('Error');
		} else {
			var listingID = $(item).attr('id').split('_')[1];
			
			// Find out which currency we are dealing with by looking for the valuta symbol
			$.each(g_CurrencyInfo, function(index) {
				if($(price).text().indexOf(this.symbol) !== -1)
				{
					g_Currency = index;
				}
			});
			
			// Just translate all commas to dots so we have floating point values
			var totalPrice = $(price).html().replace(",", ".").replace(/[^0-9.]/g, '');
			var theirPrice = $(pricenofee).html().replace(",", ".").replace(/[^0-9.]/g, '');
			
			if(totalPrice == 'Sold!') {
				$.get('/market/listings/753/' + title.substring(title.indexOf('Listings for') + 13), onCardPriceLoaded)
					.fail(function() {
						priceElement(name).html('Error');
					});
				return;
			}
			
			cards.push({listing: listingID, total: totalPrice, theirs: theirPrice, name: name});
			
			// Use new currency information
			priceElement(name).html(formatPrice(totalPrice, true));
		}
		
		if(cards.length == $('.cardprice').length) {
			var total = 0;
			for(var i = 0; i < cards.length; i++) {
				total += parseFloat(cards[i].total);
			}
			
			// Use new currency information
			$('#buycardspanel').append('<br /><span style="font-weight: bold; display: inline-block; width: ' + $('.cardname').css('width') + '; padding-right: 10px; text-align: right">Total</span><b>' + g_CurrencyInfo[g_Currency].symbol + '<span id="totalprice">' + formatPrice(total.toFixed(2)) + '</span></b><br /><br /><button type="button" id="buycardsbutton" class="btn_green_white_innerfade btn_medium_wide" style="padding: 10px 20px; margin-left: ' + ($('.cardname').css('width').replace('px', '') / 2) + 'px">PURCHASE</button>');
			$('#buycardsbutton').click(function() {
				failures = [];
				$('#buycardsbutton').hide();
				buyCard();
			});
		}
	} else {
		var countryCode = data.match(/g_strCountryCode = "[a-zA-Z0-9]+";/)[0].match(/"[a-zA-Z0-9]+/)[0].substring(1);
		g_Currency = data.match(/"wallet_currency":\d/)[0].match(/\d/)[0];
		var nameid = data.match(/Market_LoadOrderSpread\(\s?\d+\s?\);/)[0].match(/\d+/)[0];
		$.get('/market/itemordershistogram', {country: countryCode, language: 'english', currency: g_Currency, "item_nameid": nameid}, function(json) {
			if(!json.success) {
				priceElement(name).text('Error');
				return;
			}
			
			var price = (parseInt(json.lowest_sell_order) / 100).toFixed(2);
			
			cards.push({nameid: nameid, name: name, hashName: hashName, price: json.lowest_sell_order});
			priceElement(name).html(formatPrice(price, true));
			
			if(cards.length == $('.cardprice').length) {
				var total = 0;
				for(var i = 0; i < cards.length; i++) {
					total += parseFloat(cards[i].price / 100);
				}
				
				$('#buycardspanel').append('<br /><span style="font-weight: bold; display: inline-block; width: ' + $('.cardname').css('width') + '; padding-right: 10px; text-align: right">Total</span><b>' + g_CurrencyInfo[g_Currency].symbol + '<span id="totalprice">' + formatPrice(total.toFixed(2)) + '</span></b><br /><br /><button type="button" id="buycardsbutton" class="btn_green_white_innerfade btn_medium_wide" style="padding: 10px 20px; margin-left: ' + ($('.cardname').css('width').replace('px', '') / 2) + 'px">ORDERS ' + num_cards_to_buy + ' CARD(S)</button>');
				$('#buycardsbutton').click(function() {
					failures = [];
					$('#buycardsbutton').hide();
					placeBuyOrder();
				});
			}
		});
	}
}

function findElementByClass(dom, element, classname) {
	var items = dom.find(element);
	for(var i = 0; i < items.length; i++) {
		var classes = items[i].className.split(' ');
		for(var j = 0; j < classes.length; j++) {
			if(classes[j] == classname) {
				if((element == 'div' && $(findElementByClass($(items[i]), 'span', 'market_listing_price_with_fee')).html().indexOf('Sold!') == -1) || element != 'div') {
					return items[i];
				}
			}
		}
	}
}

function buyCard() {
	if(cards.length < 1) {
		if(failures.length > 0) {
			var retry = [];
			for(var i = 0; i < items.length; i++) {
				if(failures.indexOf(getCardName(items[i])) != -1) {
					retry.push(items[i]);
				}
			}
			
			items = retry;
			$('#buycardspanel').append('<button type="button" id="reloadfailuresbutton" class="btn_green_white_innerfade btn_medium_wide" style="padding: 10px 20px 10px 20px; margin-left: ' + ($('.cardname').css('width').replace('px', '') / 2 - 40) + 'px">RELOAD FAILURES</button>');
			$('#reloadfailuresbutton').click(updatePrices);
		} else {
			$('#buycardspanel').append('<button type="button" id="reloadbutton" class="btn_green_white_innerfade btn_medium_wide" style="padding: 10px 20px 10px 20px; margin-left: ' + ($('.cardname').css('width').replace('px', '') / 2 - 25) + 'px">RELOAD PAGE</button>');
			$('#reloadbutton').click(function() {
				window.location.reload();
			});
		}
		return;
	}
	
	var item = cards[0];
	if(!item) {
		return;
	}
	
	priceElement(item.name)[0].innerHTML += ' - Purchasing...';
	// Use new currency indicator
	$.post('https://steamcommunity.com/market/buylisting/' + item.listing, {sessionid: g_SessionID, currency: g_Currency, subtotal: Math.round(item.theirs * 100), fee: Math.round((item.total * 100) - (item.theirs * 100)), total: Math.round(item.total * 100)}, function(data, textStatus) {
		if(textStatus != 'success' || !data || !data.wallet_info || !data.wallet_info.success) {
			priceElement(item.name).html('Failure');
			failures.push(item.name);
			decrementTotal(item.total);
		} else {
			priceElement(item.name).html('Purchased');
		}
		
		cards.splice(0, 1);
		buyCard();
	}).fail(function(jqXHR) {
		try {
			var json = JSON.parse(jqXHR.responseText);
			priceElement(item.name).text(json.message);
		} catch(ex) {
			console.error('JSON.parse exception: ' + ex.message);
			priceElement(item.name).text('Failure');
		}
		
		failures.push(item.name);
		decrementTotal(item.total);
		
		cards.splice(0, 1);
		buyCard();
	});
}

function placeBuyOrder() {
	var card = cards.splice(0, 1)[0];
	if(!card) {
		return;
	}
	
	priceElement(card.name)[0].innerHTML += ' - Placing buy order...';
	
	$.post('https://steamcommunity.com/market/createbuyorder/', {sessionid: g_SessionID, currency: g_Currency, appid: 753, market_hash_name: card.hashName, price_total: card.price, quantity: 1}, function(json) {
		placeBuyOrder();
		
		if(!json.success) {
			priceElement(card.name).text('Failure');
			return;
		}
		
		card.orderid = json.buy_orderid;
		card.checks = 0;
		
		priceElement(card.name).text(priceElement(card.name).text().replace('Placing buy order', 'Waiting'));
		checkOrderStatus(card);
	});
}

function checkOrderStatus(card) {
	priceElement(card.name)[0].innerHTML += '.';
	
	$.get('/market/getbuyorderstatus/', {sessionid: g_SessionID, buy_orderid: card.orderid}, function(json) {
		if(!json.success) {
			setTimeout(function() {
				checkOrderStatus(card);
			}, 500);
            
            if(num_cards_bought >= num_cards_to_buy){
				/*$('#buycardspanel').append('<button type="button" id="reloadbutton" class="btn_green_white_innerfade btn_medium_wide" style="padding: 10px 20px 10px 20px; margin-left: ' + ($('.cardname').css('width').replace('px', '') / 2 - 25) + 'px">RELOAD PAGE</button>');
				$('#reloadbutton').click(function() {
					window.location.reload();
				});*/
                window.location.reload();
			}
            
			return;
		}
		
		if(json.purchases.length) {
			if(json.purchases[0].price_total < card.price) {
				decrementTotal((card.price - json.purchases[0].price_total) / 100);
			}
			
			num_cards_bought++;
            priceElement(card.name).text(formatPrice((json.purchases[0].price_total / 100).toFixed(2), true) + ' - Purchased (' + num_cards_bought + ')');
			
            if(num_cards_bought >= num_cards_to_buy){
				/*$('#buycardspanel').append('<button type="button" id="reloadbutton" class="btn_green_white_innerfade btn_medium_wide" style="padding: 10px 20px 10px 20px; margin-left: ' + ($('.cardname').css('width').replace('px', '') / 2 - 25) + 'px">RELOAD PAGE</button>');
				$('#reloadbutton').click(function() {
					window.location.reload();
				});*/
                window.location.reload();
			}
            
            return;
		}
		
		if(!json.purchases.length) {
			card.checks++;
			if(card.checks >= 10) {
				cancelBuyOrder(card.orderid);
				priceElement(card.name).text('Order unfulfilled');
				decrementTotal(card.price / 100);
                num_cards_bought++;
				
                if(num_cards_bought >= num_cards_to_buy){
					/*$('#buycardspanel').append('<button type="button" id="reloadbutton" class="btn_green_white_innerfade btn_medium_wide" style="padding: 10px 20px 10px 20px; margin-left: ' + ($('.cardname').css('width').replace('px', '') / 2 - 25) + 'px">RELOAD PAGE</button>');
					$('#reloadbutton').click(function() {
						window.location.reload();
					});*/
                	window.location.reload();
				}
                
                return;
			}
		}
		
		setTimeout(function() {
			checkOrderStatus(card);
		}, 500);
	});
}

function cancelBuyOrder(orderid) {
	$.post('/market/cancelbuyorder/', {sessionid: g_SessionID, buy_orderid: orderid}, function(json) {
		if(!json.success) {
			setTimeout(function() {
				cancelBuyOrder(orderid);
			}, 500);
		}
	});
}

function decrementTotal(total) {
	// Replace any commas to dots so we get a valid double
	$('#totalprice').text(formatPrice(($('#totalprice').text().replace(",", ".") - total).toFixed(2)));
}

function getCardName(element) {
	// Use text instead of html to prevent encoding mismatches in URLs
	return $.trim($(element).text().replace('<div style="clear: right"></div>', ''));
}

function priceElement(name) {
	var elements = $('.cardprice');
	for(var i = 0; i < elements.length; i++) {
		if($(elements[i]).data('name') == name) {
			return $(elements[i]);
		}
	}
	return null;
}
