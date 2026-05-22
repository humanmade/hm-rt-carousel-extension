<?php
/**
 * Plugin Name:  HM rtCarousel Extension
 * Description:  Registers carousel block extensions and editor enhancements.
 * Requires PHP: 8.3
 * Author:       Human Made Limited
 * Author URI:   https://humanmade.com
 * License:      GPL-2.0-or-later
 * License URI:  https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:  hm-rt-carousel-extension
 */

namespace HM\RtCarouselExtension;

const PLUGIN_FILE = __FILE__;

require_once __DIR__ . '/inc/namespace.php';

add_action( 'plugins_loaded', __NAMESPACE__ . '\\load' );

/**
 * Bootstrap the plugin once rt-carousel is confirmed available.
 *
 * @return void
 */
function load(): void {
	if ( ! defined( 'RT_CAROUSEL_PATH' ) ) {
		return;
	}

	bootstrap();
}
