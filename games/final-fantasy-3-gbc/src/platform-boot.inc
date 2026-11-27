void ff3_platform_init(void) FF3_PLATFORM_BOOT {
 /* WRAM bank 1 contains the live stack. Shared-state initialization belongs
  * to boot only, never to scene restore. A banked boot must not unmap itself. */
 SVBK_REG=1;rROMB1=0;
#ifndef FF3_SCENE_LAYOUT
 SWITCH_ROM(1);
#endif
 platform_error=0;platform_checks=0;
 ff3_state_init(ff3_game_state);
 memset((void*)FF3_STACK_GUARD,0xa7,16);
}
void ff3_platform_check(void) FF3_PLATFORM_BOOT {uint8_t i,saved=CURRENT_BANK;platform_checks++;
 if(!platform_error)ff3_platform_probe();if(CURRENT_BANK!=saved||platform_probe_failures)platform_error=4;
 if((SVBK_REG&7)!=1)platform_error=2;
 for(i=0;i<16;i++)if(((volatile uint8_t*)FF3_STACK_GUARD)[i]!=0xa7)platform_error=3;
}
